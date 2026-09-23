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

Counters are keyed by (rule, client IP), not (request path, client IP): all
paths under the default rule share one bucket per IP, so `/questions/1`,
`/questions/2`, ... can't each claim their own quota, and arbitrary (even
404) paths can't mint unbounded new counter keys. Idle keys are swept on a
bounded cadence (`cache.throttle`, see docs/adr/0010) so the store doesn't
grow with the number of distinct IPs seen since the last restart. Each key
remembers its own window for that sweep, since route handlers record into
the same store with windows the middleware knows nothing about (see
`check_and_record`).

The store is shared between the event loop (this middleware) and sync route
handlers, which FastAPI runs in its threadpool — so every read-modify-write
of it holds `_lock`. The critical sections are a few deque operations, short
enough to take on the event loop.
"""

import threading
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core import cache

Rule = tuple[int, int]

_SWEEP_INTERVAL_SECONDS = 60

_lock = threading.Lock()


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        rules: dict[str, Rule] | None = None,
        default_rule: Rule | None = None,
        scope_prefix: str = "",
        trusted_client_ip_headers: tuple[str, ...] = (),
    ):
        super().__init__(app)
        self.rules = rules or {}
        self.default_rule = default_rule
        self.scope_prefix = scope_prefix
        self.trusted_client_ip_headers = trusted_client_ip_headers

    def _rule_for(self, path: str) -> tuple[str, Rule] | None:
        # Returns the bucket name alongside the rule: the exact path for an
        # override, the shared scope prefix for the default rule.
        rule = self.rules.get(path)
        if rule is not None:
            return path, rule
        if self.default_rule is not None and path.startswith(self.scope_prefix):
            return self.scope_prefix, self.default_rule
        return None

    async def dispatch(self, request: Request, call_next):
        matched = self._rule_for(request.url.path)
        if matched is None:
            return await call_next(request)

        bucket, (limit, window_seconds) = matched
        if cache.throttle(request.app, "rate_limit:sweep", _SWEEP_INTERVAL_SECONDS):
            _sweep_idle(request.app, time.monotonic())

        client_ip = _client_ip(request, self.trusted_client_ip_headers)
        if not check_and_record(request.app, bucket, client_ip, limit, window_seconds):
            return JSONResponse({"detail": "Too many requests"}, status_code=429)

        return await call_next(request)


def _client_ip(request: Request, trusted_headers: tuple[str, ...]) -> str:
    # Behind a proxy, request.client.host is the proxy, which would collapse
    # every caller into one bucket. The client IP has to come from a header
    # that proxy sets — but only a header it *overwrites*, never one a client
    # can pre-fill. Which headers qualify depends on the deployment, so they
    # are passed in (see app/main.py) rather than guessed here: on Render,
    # Cloudflare sits in front and sets CF-Connecting-IP/True-Client-IP.
    #
    # X-Forwarded-For is deliberately not used. The last entry is a proxy hop
    # shared by many clients (verified in production: every caller landed in
    # one bucket), and the first entry is only trustworthy if the proxy
    # replaces client-sent values — see docs/adr/0007's addendum.
    #
    # With no trusted headers configured (local dev, tests, any non-Render
    # host) this falls back to the socket peer, so a client can never dodge
    # the limit by sending one of these headers itself.
    for header in trusted_headers:
        value = request.headers.get(header, "").strip()
        if value:
            return value
    return request.client.host if request.client else "unknown"


def check_and_record(app, bucket: str, key: str, limit: int, window_seconds: int) -> bool:
    """Sliding-window rate check: True (and records a hit) if within limit.

    Shared by the middleware above (keyed by client IP) and by route
    handlers that need a second, differently-keyed cap on top of the IP-based
    one — e.g. the email-change-request endpoint, which also limits by
    authenticated user id, since the per-IP cap alone doesn't stop one
    account probing many addresses from multiple IPs.
    """
    now = time.monotonic()
    with _lock:
        hits = _hits_for(app, (bucket, key))
        _windows_for(app)[(bucket, key)] = window_seconds
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True


def forget_last(app, bucket: str, key: str) -> None:
    """Take back the newest hit `check_and_record` recorded — for an attempt that failed on our side."""
    with _lock:
        hits = _hits_for(app, (bucket, key))
        if hits:
            hits.pop()


def _sweep_idle(app, now: float) -> None:
    # A key whose newest hit is older than its own window can't affect any
    # future decision — drop it.
    store = getattr(app.state, "rate_limit_hits", None)
    if not store:
        return
    with _lock:
        windows = _windows_for(app)
        idle = [k for k, hits in store.items() if not hits or now - hits[-1] > windows.get(k, 0)]
        for key in idle:
            del store[key]
            windows.pop(key, None)


def _hits_for(app, key: tuple[str, str]) -> deque:
    if not hasattr(app.state, "rate_limit_hits"):
        app.state.rate_limit_hits = defaultdict(deque)
    return app.state.rate_limit_hits[key]


def _windows_for(app) -> dict[tuple[str, str], int]:
    if not hasattr(app.state, "rate_limit_windows"):
        app.state.rate_limit_windows = {}
    return app.state.rate_limit_windows
