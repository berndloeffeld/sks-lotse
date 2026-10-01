"""Cap on request body size, before anything reads the body.

FastAPI reads a JSON body into memory in full before validating it, and nothing in front of the app
(Render's proxy) caps it. The open routes (/auth/otp/*, /payments/webhook) would accept any size
from anyone — on a 512 MB instance, where a crash also resets the in-memory rate limits. Every
body the API takes is small (an email, a code, a learner's answer), so a request over the limit is
answered 413 without the app ever seeing it.

Pure ASGI rather than BaseHTTPMiddleware (like RequestIdMiddleware in app/core/log_config.py): the
body is counted as the server delivers it, so a chunked upload without Content-Length stops at the
limit instead of after it has been buffered.
"""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

DEFAULT_MAX_BODY_BYTES = 64 * 1024
# Stripe's event payloads (ADR-0048) carry the whole Checkout Session; they stay well under this.
WEBHOOK_MAX_BODY_BYTES = 1024 * 1024
WEBHOOK_PATH = "/api/v1/payments/webhook"


def max_body_bytes(path: str) -> int:
    return WEBHOOK_MAX_BODY_BYTES if path == WEBHOOK_PATH else DEFAULT_MAX_BODY_BYTES


def declared_length(scope: Scope) -> int | None:
    """The Content-Length header as a number, or None (absent, chunked, or not a number)."""
    for name, value in scope.get("headers", []):
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


def _too_large() -> JSONResponse:
    return JSONResponse({"detail": "Request body too large"}, status_code=413)


class RequestBodyLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = max_body_bytes(scope["path"])
        length = declared_length(scope)
        if length is not None and length > limit:
            await _too_large()(scope, receive, send)
            return
        # Read the whole body here, counting as it arrives, and hand it on in one message — the
        # app would buffer it anyway, and a 413 must go out before the app has started a response.
        body = bytearray()
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] != "http.request":
                # The client went away mid-body: let the app see the disconnect as it would have.
                await self.app(scope, _replay(message, receive), send)
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                await _too_large()(scope, receive, send)
                return
            more_body = message.get("more_body", False)
        await self.app(scope, _replay({"type": "http.request", "body": bytes(body)}, receive), send)


def _replay(first: Message, receive: Receive) -> Receive:
    """A receive callable that yields `first` once, then defers to the server's (disconnects)."""
    pending: list[Message] = [first]

    async def replayed() -> Message:
        if pending:
            return pending.pop()
        return await receive()

    return replayed
