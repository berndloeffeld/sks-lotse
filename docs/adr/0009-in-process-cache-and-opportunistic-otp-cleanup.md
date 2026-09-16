# 0009. In-process cache for the question catalog, and opportunistic OTP-code cleanup — no new infrastructure

Status: Accepted

## Context

Two unrelated needs came up together while reviewing the data layer for growth patterns:

1. **Read load on the question catalog.** `GET /api/v1/questions`, `/questions/random`, and `/questions/{id}` are the most-read endpoints in the app — every practice session hits them — against a table (`questions`) that only ever changes via a one-off offline import script (`backend/scripts/import_catalog.py`), never through the API itself.
2. **Unbounded growth of `otp_codes`.** Every `POST /auth/otp/request` call inserts a row; nothing ever deleted one. A code is only useful for `OTP_TTL_MINUTES` (10 minutes) — everything past that is pure dead weight that would grow forever with usage.

Options considered for *where a cache's state lives*: a module-level global, vs. `app.state` (the pattern `rate_limit.py` already established for exactly this kind of per-process, swappable-for-Redis-later state — see [ADR-0007](0007-in-memory-per-ip-rate-limiting.md)).

Options considered for *cleaning up `otp_codes`*:
1. A scheduled job (cron/worker) that periodically deletes expired rows.
2. Delete opportunistically as a side effect of the code that already writes to the table.

Options considered for *when the delete in option 2 runs*:
1. Inline, in the same request/transaction as issuing the new code — simplest, but the DELETE adds latency to every successful `/auth/otp/request` call, worse the more traffic that endpoint sees.
2. Deferred to a FastAPI `BackgroundTasks` callback, so it runs after the response is already sent to the caller.

## Decision

- **`backend/app/core/cache.py`**: a minimal `get_or_set(app, key, ttl_seconds, factory)` / `invalidate(app, key)` cache, state on `app.state.cache_entries` (same reasoning and same shape as `rate_limit.py`'s `app.state.rate_limit_hits`: single Render instance, no multi-instance correctness problem to solve, and tests can reset it the same way `_reset_rate_limits` already does). `backend/app/api/v1/questions.py` caches the whole catalog (as validated `QuestionRead` schemas, not live ORM objects — see Consequences) for 1 hour and filters/picks in Python instead of hitting the DB on every request.
- **Option 2** for OTP cleanup, **run as a background task** (option 2 of the second choice): `request_otp` schedules `_cleanup_expired_otp_codes` via `BackgroundTasks.add_task` instead of calling it inline — it deletes `otp_codes` rows past `OTP_CODE_RETENTION_HOURS` (24h), committing on its own since the request has already returned its response by the time it runs. FastAPI closes a `yield`-based dependency (here, the DB session from `get_db`) only after background tasks finish, so reusing the request's `db` session here is safe. No new scheduled job, no new service.
- Added `ix_otp_codes_expires_at` (`backend/app/models/otp_code.py`) so that cleanup's `WHERE expires_at < cutoff` isn't a sequential scan — the existing `(email, created_at)` composite doesn't cover it, since that query has no `email` predicate.

## Consequences

- Zero new infrastructure, zero new cost, consistent with this project's stated preference for a small infrastructure surface ([ADR-0002](0002-modulith-over-microservices.md), [ADR-0005](0005-render-deployment-topology.md), ADR-0007).
- The cache stores `QuestionRead` Pydantic instances, not `Question` ORM rows: caching live ORM objects across requests would mean serving instances bound to a `Session` from a since-closed request, which is a well-known SQLAlchemy foot-gun (`DetachedInstanceError` on any attribute that wasn't eagerly loaded). Caching the already-validated response schema sidesteps that entirely and is exactly the data being served anyway.
- Same ceiling as ADR-0007: the cache and the cleanup both reset on restart/redeploy, and a second instance wouldn't share either — both fine under the current single-instance topology, both worth revisiting if that changes.
- OTP cleanup is opportunistic, not exact: rows only get swept when *someone, anywhere* requests a new code. A quiet period leaves stale rows sitting past their retention window a little longer than 24h — acceptable, since the goal is bounding long-run growth, not enforcing a precise deletion SLA. If the app ever gains a real scheduler (a Render Cron Job, a worker), this is the first candidate to move there instead.
- Running cleanup as a background task means the caller of `/auth/otp/request` never waits on it — the DELETE's cost no longer scales with that endpoint's request latency. It doesn't reduce total DB load (still one DELETE per successful request that finds the retention window worth sweeping); if that ever matters, the next lever is running it probabilistically (e.g. on 1 in N requests) rather than every time.
- The cache interface (`get_or_set`/`invalidate`) is the only thing callers touch, so swapping the backing store for Redis later — if the app ever runs more than one instance — is additive, not a rewrite, exactly like ADR-0007's rate-limit counters.
