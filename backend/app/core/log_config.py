"""Process-wide logging setup: one line per record, JSON in production.

Render streams stdout/stderr to Better Stack (via syslog-ng), which turns JSON lines into
searchable fields — so an alert can match on `level` or `logger` instead of a regex over free
text. Locally the same records print as readable text. Without this setup Python's fallback
handler printed WARNING and above only, with no timestamp, level or logger name.

Every record carries the id of the request it was logged in (`RequestIdMiddleware`), so the
lines of one failing request can be found together. Uvicorn keeps its own access/error loggers.
"""

import json
import logging
import string
import sys
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "x-request-id"

_logger = logging.getLogger(__name__)
_ID_CHARS = frozenset(string.ascii_letters + string.digits + "-_")

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)

# Attributes every LogRecord has — anything else was passed via `extra=` and belongs in the output.
_STANDARD_ATTRS = set(vars(logging.makeLogRecord({}))) | {"message", "asctime", "request_id"}


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = getattr(record, "request_id", None)
        if request_id:
            entry["request_id"] = request_id
        entry.update({k: v for k, v in vars(record).items() if k not in _STANDARD_ATTRS})
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


_TEXT_FORMAT = "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"


def configure_logging(level: str, fmt: str) -> None:
    """Replace the root logger's handlers with one stdout handler (idempotent)."""
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(JsonFormatter() if fmt == "json" else logging.Formatter(_TEXT_FORMAT))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # The HTTP clients under the Anthropic/Resend SDKs log every request at INFO — noise that says
    # nothing the app's own lines don't. Their warnings and errors still come through.
    for noisy in ("httpx", "httpcore", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


class RequestIdMiddleware:
    """Tags each request with an id (the caller's `X-Request-ID` if sane, else a new one).

    Pure ASGI rather than BaseHTTPMiddleware, so the context variable is set in the same context
    the route handler — and the threadpool it runs sync handlers in — inherits.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = _incoming_id(scope) or uuid.uuid4().hex
        token = _request_id.set(request_id)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                message["headers"].append((REQUEST_ID_HEADER.encode(), request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            # Logged here, while the request id is still set: Starlette's error middleware (which
            # turns this into the 500) sits outside every user middleware. One record, traceback
            # included, so a Better Stack alert on level=ERROR catches every unhandled crash.
            _logger.exception(
                "Unhandled exception", extra={"method": scope.get("method"), "path": scope.get("path")}
            )
            raise
        finally:
            _request_id.reset(token)


def _incoming_id(scope: Scope) -> str | None:
    # Accept a caller-supplied id only if it's short and plain, so it can't inject into a log line.
    for name, value in scope.get("headers", []):
        if name == REQUEST_ID_HEADER.encode():
            candidate = value.decode("latin-1")
            if 0 < len(candidate) <= 64 and all(c in _ID_CHARS for c in candidate):
                return candidate
    return None


def current_request_id() -> str | None:
    return _request_id.get()
