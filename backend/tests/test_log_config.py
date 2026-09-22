import json
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core import log_config


def _record(message="hello", **extra):
    return logging.makeLogRecord({"name": "app.test", "levelname": "WARNING", "msg": message, **extra})


def test_json_formatter_emits_one_parseable_line_with_the_fields():
    line = log_config.JsonFormatter().format(_record(request_id="abc", user=7))
    entry = json.loads(line)
    assert entry["level"] == "WARNING"
    assert entry["logger"] == "app.test"
    assert entry["message"] == "hello"
    assert entry["request_id"] == "abc"
    assert entry["user"] == 7
    assert "\n" not in line


def test_json_formatter_includes_the_traceback():
    try:
        raise ValueError("boom")
    except ValueError:
        import sys

        record = _record(exc_info=sys.exc_info())
    entry = json.loads(log_config.JsonFormatter().format(record))
    assert "ValueError: boom" in entry["exception"]
    assert "request_id" not in entry


@pytest.mark.parametrize(
    ("fmt", "formatter"), [("json", log_config.JsonFormatter), ("text", logging.Formatter)]
)
def test_configure_logging_installs_a_single_handler(fmt, formatter):
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    try:
        log_config.configure_logging("INFO", fmt)
        log_config.configure_logging("INFO", fmt)
        assert len(root.handlers) == 1
        assert type(root.handlers[0].formatter) is formatter
        assert root.level == logging.INFO
        assert logging.getLogger("httpx").level == logging.WARNING
    finally:
        root.handlers[:], root.level = saved_handlers, saved_level


def _app():
    app = FastAPI()
    seen = {}

    @app.get("/sync")
    def sync_route():
        # Sync handlers run in the threadpool — the id must still be visible there.
        seen["id"] = log_config.current_request_id()
        return {}

    @app.get("/boom")
    def boom():
        raise RuntimeError("kaputt")

    app.add_middleware(log_config.RequestIdMiddleware)
    return app, seen


def test_each_request_gets_an_id_in_the_response_and_the_handler_context():
    app, seen = _app()
    response = TestClient(app).get("/sync")
    assert response.headers["x-request-id"] == seen["id"]
    assert len(seen["id"]) == 32
    assert log_config.current_request_id() is None


@pytest.mark.parametrize(
    ("incoming", "kept"),
    [("trace-123_ok", True), ("bad id\nwith newline", False), ("x" * 65, False), ("", False)],
)
def test_a_caller_supplied_id_is_kept_only_if_plain(incoming, kept):
    app, _ = _app()
    response = TestClient(app).get("/sync", headers={"X-Request-ID": incoming})
    assert (response.headers["x-request-id"] == incoming) is kept


def test_an_unhandled_exception_is_logged_once_with_the_request_id(caplog):
    app, _ = _app()
    with caplog.at_level("ERROR", logger="app.core.log_config"):
        response = TestClient(app, raise_server_exceptions=False).get(
            "/boom", headers={"X-Request-ID": "req-1"}
        )
    assert response.status_code == 500
    [record] = [r for r in caplog.records if r.name == "app.core.log_config"]
    assert record.getMessage() == "Unhandled exception"
    assert record.path == "/boom"
    assert record.method == "GET"
    assert record.exc_info is not None


def test_non_http_scopes_pass_straight_through():
    import asyncio

    calls = []

    async def inner(scope, receive, send):
        calls.append(scope["type"])

    asyncio.run(log_config.RequestIdMiddleware(inner)({"type": "lifespan"}, None, None))
    assert calls == ["lifespan"]


def _emit_through_configured_root(fmt, message="Prüfung", **extra):
    # Runs a record through the handler configure_logging installs, the way production does.
    import io

    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    try:
        log_config.configure_logging("INFO", fmt)
        stream = io.StringIO()
        root.handlers[0].setStream(stream)
        logging.getLogger("app.test").warning(message, extra=extra)
        return stream.getvalue()
    finally:
        root.handlers[:], root.level = saved_handlers, saved_level


def test_configured_json_output_keeps_umlauts_and_has_every_field():
    line = _emit_through_configured_root("json", request_ref=1)
    assert "Prüfung" in line
    entry = json.loads(line)
    assert set(entry) == {"time", "level", "logger", "message", "request_ref"}
    assert entry["time"].endswith("+00:00")


def test_configured_text_output_has_level_logger_and_request_id_slot():
    line = _emit_through_configured_root("text")
    assert line.rstrip("\n").endswith(" WARNING app.test [None] Prüfung")


def test_configure_logging_quiets_every_http_client_logger():
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    try:
        log_config.configure_logging("DEBUG", "text")
        assert root.level == logging.DEBUG
        for name in ("httpx", "httpcore", "urllib3"):
            assert logging.getLogger(name).level == logging.WARNING
    finally:
        root.handlers[:], root.level = saved_handlers, saved_level


def test_records_logged_during_a_request_carry_its_id():
    app = FastAPI()

    @app.get("/log")
    def log_route():
        logging.getLogger("app.test").warning("inside")
        return {}

    app.add_middleware(log_config.RequestIdMiddleware)
    record = _record()
    handler_filter = log_config._RequestIdFilter()
    captured = []

    class _Capture(logging.Handler):
        def emit(self, record):
            captured.append(record)

    handler = _Capture()
    handler.addFilter(handler_filter)
    logger = logging.getLogger("app.test")
    logger.addHandler(handler)
    try:
        response = TestClient(app).get("/log", headers={"X-Request-ID": "abc-1"})
    finally:
        logger.removeHandler(handler)
    assert response.headers["x-request-id"] == "abc-1"
    assert [r.request_id for r in captured] == ["abc-1"]
    assert handler_filter.filter(record) is True
    assert record.request_id is None


@pytest.mark.parametrize("incoming", ["x" * 64, "-", "_", "Ab9"])
def test_boundary_ids_are_accepted(incoming):
    app, _ = _app()
    assert (
        TestClient(app).get("/sync", headers={"X-Request-ID": incoming}).headers["x-request-id"] == incoming
    )


def test_request_body_and_existing_response_headers_survive_the_middleware():
    app = FastAPI()

    @app.post("/echo")
    async def echo(payload: dict):
        from fastapi.responses import JSONResponse

        return JSONResponse(payload, headers={"x-extra": "1"})

    app.add_middleware(log_config.RequestIdMiddleware)
    response = TestClient(app).post("/echo", json={"a": 1})
    assert response.json() == {"a": 1}
    assert response.headers["x-extra"] == "1"
    assert "x-request-id" in response.headers


def test_a_scope_without_headers_gets_a_fresh_id():
    assert log_config._incoming_id({"type": "http"}) is None
    assert (
        log_config._incoming_id({"type": "http", "headers": [(b"x-request-id", "ä".encode("latin-1"))]})
        is None
    )
