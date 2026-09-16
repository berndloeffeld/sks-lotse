# 0010. Opportunistic OTP-code cleanup, run as a background task

Status: Accepted

## Context

Every `POST /auth/otp/request` call inserts a row into `otp_codes`; nothing ever deleted one. A code is only useful for `OTP_TTL_MINUTES` (10 minutes) — everything past that is pure dead weight that would grow forever with usage.

Options considered for *how cleanup happens at all*:
1. A scheduled job (cron/worker) that periodically deletes expired rows.
2. Delete opportunistically as a side effect of the code that already writes to the table.

Options considered for *when the delete in option 2 runs*:
1. Inline, in the same request/transaction as issuing the new code — simplest, but the DELETE adds latency to every successful `/auth/otp/request` call, worse the more traffic that endpoint sees.
2. Deferred to a FastAPI `BackgroundTasks` callback, so it runs after the response is already sent to the caller.

## Decision

Option 2 for both: `request_otp` schedules `_cleanup_expired_otp_codes` via `BackgroundTasks.add_task` (`backend/app/api/v1/auth.py`) instead of calling it inline. It deletes `otp_codes` rows past `OTP_CODE_RETENTION_HOURS` (24h), committing on its own since the request has already returned its response by the time it runs. FastAPI closes a `yield`-based dependency (here, the DB session from `get_db`) only after background tasks finish, so reusing the request's `db` session here is safe. No new scheduled job, no new service.

Added `ix_otp_codes_expires_at` (`backend/app/models/otp_code.py`) so the cleanup's `WHERE expires_at < cutoff` isn't a sequential scan — the existing `(email, created_at)` composite index (added for the request-rate-limit and latest-code lookups) doesn't cover it, since that query has no `email` predicate.

## Consequences

- Zero new infrastructure, zero new cost, consistent with this project's stated preference for a small infrastructure surface ([ADR-0002](0002-modulith-over-microservices.md), [ADR-0005](0005-render-deployment-topology.md), [ADR-0007](0007-in-memory-per-ip-rate-limiting.md)).
- Cleanup is opportunistic, not exact: rows only get swept when *someone, anywhere* requests a new code. A quiet period leaves stale rows sitting past their retention window a little longer than 24h — acceptable, since the goal is bounding long-run growth, not enforcing a precise deletion SLA. If the app ever gains a real scheduler (a Render Cron Job, a worker), this is the first candidate to move there instead.
- Resets on restart/redeploy the same way the rate limiter and cache do (ADR-0007, [ADR-0009](0009-in-process-cache-for-question-catalog.md)): a mid-cleanup crash just means the next successful request tries again, not a correctness problem.
- Running cleanup as a background task means the caller of `/auth/otp/request` never waits on it — the DELETE's cost no longer scales with that endpoint's response latency. It doesn't reduce total DB load (still one DELETE per successful request that finds the retention window worth sweeping); if that ever matters, the next lever is running it probabilistically (e.g. on 1 in N requests) rather than every time.
