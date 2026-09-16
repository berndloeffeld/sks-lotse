"""In-memory rate limiting, keyed by (path, client IP).

In-memory by design: Render currently runs a single instance (see
docs/adr/0005-render-deployment-topology.md), so there's no need for a
shared store like Redis. Counters reset on restart/redeploy and don't
sync across instances — an acceptable ceiling for an MVP, not a hard
guarantee. Revisit with a shared store if that topology changes.

Two kinds of rule, both `(max_requests, window_seconds)`:
- `rules`: exact-path overrides for endpoints that need a tighter cap
  (e.g. OTP requests, to bound cost/spam independent of the general cap).
- `default_rule`: a generous blanket cap applied to any path under
  `scope_prefix` that has no exact-path override, so new endpoints are
  covered without touching this file again.
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

Rule = tuple[int, int]


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        rules: dict[str, Rule] | None = None,
        default_rule: Rule | None = None,
        scope_prefix: str = "",
    ):
        super().__init__(app)
        self.rules = rules or {}
        self.default_rule = default_rule
        self.scope_prefix = scope_prefix

    def _rule_for(self, path: str) -> Rule | None:
        rule = self.rules.get(path)
        if rule is not None:
            return rule
        if self.default_rule is not None and path.startswith(self.scope_prefix):
            return self.default_rule
        return None

    async def dispatch(self, request: Request, call_next):
        rule = self._rule_for(request.url.path)
        if rule is None:
            return await call_next(request)

        limit, window_seconds = rule
        hits = _hits_for(request.app, (request.url.path, _client_ip(request)))

        now = time.monotonic()
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return JSONResponse({"detail": "Too many requests"}, status_code=429)

        hits.append(now)
        return await call_next(request)


def _client_ip(request: Request) -> str:
    # Render sits in front of the app as the sole reverse-proxy hop and
    # appends the connecting IP to X-Forwarded-For itself (rather than
    # trusting whatever a client already sent), so the *last* entry is the
    # one hop we don't control and can trust — never the first, which a
    # client can freely set to spoof its way into a fresh rate-limit bucket.
    # request.client.host would otherwise be Render's proxy IP, collapsing
    # every caller into one bucket. Falls back to it when the header is
    # absent (local dev, tests).
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _hits_for(app, key: tuple[str, str]) -> deque:
    if not hasattr(app.state, "rate_limit_hits"):
        app.state.rate_limit_hits = defaultdict(deque)
    return app.state.rate_limit_hits[key]
