"""Defense-in-depth response headers, applied to every response.

Render (see docs/adr/0005-render-deployment-topology.md) already serves the
canonical domain over HTTPS with an auto-renewed Let's Encrypt cert, but
doesn't add these headers itself — the app has to.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Tell browsers to only ever reach this host over HTTPS, including
        # subdomains (www) — two years, the conventional HSTS max-age.
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        # Stop browsers from MIME-sniffing a response into executing as a
        # different content type than declared.
        response.headers["X-Content-Type-Options"] = "nosniff"
        # This API serves no HTML for anything to frame; deny embedding outright.
        response.headers["X-Frame-Options"] = "DENY"
        # An API response has no reason to leak its URL to a third party.
        response.headers["Referrer-Policy"] = "no-referrer"
        # API responses carry per-user data (tokens from otp/verify, /me) —
        # never let a browser or intermediary cache them. Routes that want
        # caching can still set their own Cache-Control.
        if request.url.path.startswith("/api/") and "cache-control" not in response.headers:
            response.headers["Cache-Control"] = "no-store"
        return response
