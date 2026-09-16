"""In-memory rate limiting for specific endpoints, keyed by (path, client IP).

In-memory by design: Render currently runs a single instance (see
docs/adr/0005-render-deployment-topology.md), so there's no need for a
shared store like Redis. Counters reset on restart/redeploy and don't
sync across instances — an acceptable ceiling for an MVP, not a hard
guarantee. Revisit with a shared store if that topology changes.

This is deliberately generic (a `{path: (limit, window_seconds)}` rule
table) so future endpoints can opt in without new middleware.
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rules: dict[str, tuple[int, int]]):
        super().__init__(app)
        self.rules = rules  # {path: (max_requests, window_seconds)}

    async def dispatch(self, request: Request, call_next):
        rule = self.rules.get(request.url.path)
        if rule is None:
            return await call_next(request)

        limit, window_seconds = rule
        ip = request.client.host if request.client else "unknown"
        hits = _hits_for(request.app, (request.url.path, ip))

        now = time.monotonic()
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return JSONResponse({"detail": "Too many requests"}, status_code=429)

        hits.append(now)
        return await call_next(request)


def _hits_for(app, key: tuple[str, str]) -> deque:
    if not hasattr(app.state, "rate_limit_hits"):
        app.state.rate_limit_hits = defaultdict(deque)
    return app.state.rate_limit_hits[key]
