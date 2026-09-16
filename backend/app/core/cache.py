"""In-memory, per-process cache with a TTL, keyed by an arbitrary string.

In-memory by design, same reasoning as rate_limit.py (single Render
instance, docs/adr/0005): no shared-cache correctness problem to solve
yet. State lives on `app.state`, not a module global, so it doesn't leak
between the separate FastAPI app instances tests spin up, and so tests
can reset it between runs — mirrors rate_limit.py's `_hits_for`.

`get_or_set`/`invalidate` are deliberately the only surface callers use,
so a Redis-backed implementation can later replace `_entries_for`'s
storage without touching call sites. See docs/adr/0009.
"""

import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def get_or_set(app, key: str, ttl_seconds: float, factory: Callable[[], T]) -> T:
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


def _entries_for(app) -> dict[str, tuple[float, object]]:
    if not hasattr(app.state, "cache_entries"):
        app.state.cache_entries = {}
    return app.state.cache_entries
