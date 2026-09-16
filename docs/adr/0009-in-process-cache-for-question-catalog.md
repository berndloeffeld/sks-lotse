# 0009. In-process cache for the question catalog

Status: Accepted

## Context

`GET /api/v1/questions`, `/questions/random`, and `/questions/{id}` are the most-read endpoints in the app — every practice session hits them — against a table (`questions`) that only ever changes via a one-off offline import script (`backend/scripts/import_catalog.py`), never through the API itself. That combination (heavy reads, no write path in the app itself) is a natural fit for a cache.

Options considered for *where a cache's state lives*: a module-level global, vs. `app.state` (the pattern `rate_limit.py` already established for exactly this kind of per-process, swappable-for-Redis-later state — see [ADR-0007](0007-in-memory-per-ip-rate-limiting.md)).

## Decision

`backend/app/core/cache.py`: a minimal `get_or_set(app, key, ttl_seconds, factory)` / `invalidate(app, key)` cache, state on `app.state.cache_entries` (same reasoning and same shape as `rate_limit.py`'s `app.state.rate_limit_hits`: single Render instance, no multi-instance correctness problem to solve, and tests can reset it the same way `_reset_rate_limits` already does). `backend/app/api/v1/questions.py` caches the whole catalog (as validated `QuestionRead` schemas, not live ORM objects — see Consequences) for 1 hour and filters/picks in Python instead of hitting the DB on every request.

## Consequences

- Zero new infrastructure, zero new cost, consistent with this project's stated preference for a small infrastructure surface ([ADR-0002](0002-modulith-over-microservices.md), [ADR-0005](0005-render-deployment-topology.md), ADR-0007).
- The cache stores `QuestionRead` Pydantic instances, not `Question` ORM rows: caching live ORM objects across requests would mean serving instances bound to a `Session` from a since-closed request, which is a well-known SQLAlchemy foot-gun (`DetachedInstanceError` on any attribute that wasn't eagerly loaded). Caching the already-validated response schema sidesteps that entirely and is exactly the data being served anyway.
- Same ceiling as ADR-0007: the cache resets on restart/redeploy, and a second instance wouldn't share it — fine under the current single-instance topology, worth revisiting if that changes.
- The cache interface (`get_or_set`/`invalidate`) is the only thing callers touch, so swapping the backing store for Redis later — if the app ever runs more than one instance — is additive, not a rewrite, exactly like ADR-0007's rate-limit counters.
