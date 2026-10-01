import asyncio

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core import request_limits
from app.core.request_limits import RequestBodyLimitMiddleware


def _app():
    app = FastAPI()
    app.add_middleware(RequestBodyLimitMiddleware)

    @app.post("/echo")
    async def echo(request: Request):
        return {"size": len(await request.body())}

    @app.post(request_limits.WEBHOOK_PATH)
    async def webhook(request: Request):
        return {"size": len(await request.body())}

    return TestClient(app)


def _chunks(total: int, chunk: int = 8 * 1024):
    sent = 0
    while sent < total:
        size = min(chunk, total - sent)
        sent += size
        yield b"x" * size


def test_a_body_at_the_limit_passes_through_whole():
    response = _app().post("/echo", content=b"x" * request_limits.DEFAULT_MAX_BODY_BYTES)
    assert response.status_code == 200
    assert response.json() == {"size": request_limits.DEFAULT_MAX_BODY_BYTES}


def test_a_declared_length_over_the_limit_is_a_413():
    response = _app().post("/echo", content=b"x" * (request_limits.DEFAULT_MAX_BODY_BYTES + 1))
    assert response.status_code == 413
    assert response.json() == {"detail": "Request body too large"}


def test_a_chunked_body_is_cut_off_at_the_limit():
    client = _app()
    # A generator makes httpx send Transfer-Encoding: chunked, no Content-Length.
    over = client.post("/echo", content=_chunks(request_limits.DEFAULT_MAX_BODY_BYTES + 1))
    assert over.status_code == 413
    under = client.post("/echo", content=_chunks(request_limits.DEFAULT_MAX_BODY_BYTES))
    assert under.status_code == 200
    assert under.json() == {"size": request_limits.DEFAULT_MAX_BODY_BYTES}


def test_the_webhook_gets_the_larger_limit():
    client = _app()
    body = b"x" * (request_limits.DEFAULT_MAX_BODY_BYTES + 1)
    assert client.post(request_limits.WEBHOOK_PATH, content=body).status_code == 200
    too_big = b"x" * (request_limits.WEBHOOK_MAX_BODY_BYTES + 1)
    assert client.post(request_limits.WEBHOOK_PATH, content=too_big).status_code == 413


@pytest.mark.parametrize(
    ("path", "limit"),
    [
        ("/api/v1/auth/otp/request", 64 * 1024),
        ("/api/v1/payments/webhook", 1024 * 1024),
        ("/api/v1/payments/webhook/", 64 * 1024),
    ],
)
def test_max_body_bytes(path, limit):
    assert request_limits.max_body_bytes(path) == limit


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ([(b"content-length", b"12")], 12),
        ([(b"content-type", b"application/json"), (b"content-length", b"0")], 0),
        ([(b"content-length", b"twelve")], None),
        ([(b"content-type", b"application/json")], None),
        ([], None),
    ],
)
def test_declared_length(headers, expected):
    assert request_limits.declared_length({"headers": headers}) == expected


def test_the_main_app_refuses_an_oversized_login_request(client):
    response = client.post(
        "/api/v1/auth/otp/request",
        content=b'{"email": "' + b"a" * (64 * 1024) + b'@example.com"}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    # Outside the rate limiter, inside the header middlewares.
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "x-request-id" in response.headers


def _run(middleware, scope, messages):
    sent: list[dict] = []
    incoming = list(messages)

    async def receive():
        return incoming.pop(0)

    async def send(message):
        sent.append(message)

    asyncio.run(middleware(scope, receive, send))
    return sent


def test_a_disconnect_mid_body_reaches_the_app():
    seen: list[dict] = []

    async def app(scope, receive, send):
        seen.append(await receive())
        seen.append(await receive())

    messages = [
        {"type": "http.request", "body": b"abc", "more_body": True},
        {"type": "http.disconnect"},
        {"type": "http.disconnect"},
    ]
    _run(RequestBodyLimitMiddleware(app), {"type": "http", "path": "/echo", "headers": []}, messages)
    assert seen == [{"type": "http.disconnect"}, {"type": "http.disconnect"}]


def test_the_app_receives_the_body_in_one_message_then_the_servers_messages():
    seen: list[dict] = []

    async def app(scope, receive, send):
        seen.append(await receive())
        seen.append(await receive())

    messages = [
        {"type": "http.request", "body": b"ab", "more_body": True},
        {"type": "http.request", "body": b"cd"},
        {"type": "http.disconnect"},
    ]
    _run(RequestBodyLimitMiddleware(app), {"type": "http", "path": "/echo", "headers": []}, messages)
    assert seen == [{"type": "http.request", "body": b"abcd"}, {"type": "http.disconnect"}]


def test_non_http_scopes_pass_through_untouched():
    calls: list[str] = []

    async def app(scope, receive, send):
        calls.append(scope["type"])

    _run(RequestBodyLimitMiddleware(app), {"type": "lifespan"}, [])
    assert calls == ["lifespan"]
