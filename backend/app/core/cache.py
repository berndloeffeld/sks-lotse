"""In-memory, per-process cache with a TTL, keyed by an arbitrary string.

In-memory by design, same reasoning as rate_limit.py (single Render
instance, docs/adr/0005): no shared-cache correctness problem to solve
yet. State lives on `app.state`, not a module global, so it doesn't leak
between the separate FastAPI app instances tests spin up, and so tests
can reset it between runs — mirrors rate_limit.py's `_hits_for`.

`get_or_set`/`invalidate` are deliberately the only surface callers use,
so a Redis-backed implementation can later replace `_entries_for`'s
storage without touching call sites. See docs/adr/0009.

`throttle` is built on the same primitive but for a different purpose:
gating opportunistic maintenance work that piggybacks on request traffic
(e.g. sweeping expired rows — see docs/adr/0010) rather than caching a
value, so its frequency is bounded regardless of how often the endpoint
triggering it gets called. See CLAUDE.md → Data Layer Conventions.
"""

import time
from collections.abc import Callable


def get_or_set[T](app, key: str, ttl_seconds: float, factory: Callable[[], T]) -> T:
    entries = _entries_for(app)
    now = time.monotonic()
    cached = entries.get(key)
    if cached is not None and cached[0] > now:
        return cached[1]
    value = factory()
    entries[key] = (now + ttl_seconds, value)
    return value


def invalidate(app, key: str) -> None:
    _entries_for(app).pop(key, None)


def throttle(app, key: str, min_interval_seconds: float) -> bool:
    """True at most once per min_interval_seconds for a given key.

    Call this before doing recurring maintenance work that's triggered by
    request traffic instead of a real scheduler, and only do the work if
    it returns True — that bounds the work's frequency to the interval
    instead of "once per call", the same way a cron job would, without
    standing up an actual scheduler.

    Implemented as a `get_or_set` whose factory is only ever invoked on a
    cache miss: a fresh sentinel is cached under `key` for the interval,
    and the return value tells the caller whether *this* call was the one
    that just created it (True) or found an existing one from within the
    window (False).
    """
    marker = object()
    return get_or_set(app, key, min_interval_seconds, lambda: marker) is marker


def _entries_for(app) -> dict[str, tuple[float, object]]:
    if not hasattr(app.state, "cache_entries"):
        app.state.cache_entries = {}
    return app.state.cache_entries
