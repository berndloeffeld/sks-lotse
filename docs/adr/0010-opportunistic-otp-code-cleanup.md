# 0010. Opportunistic OTP-code cleanup, throttled and run as a background task

Status: Accepted

## Context

Every `POST /auth/otp/request` call inserts a row into `otp_codes`; nothing ever deleted one. A code is only useful for `OTP_TTL_MINUTES` (10 minutes) — everything past that is pure dead weight that would grow forever with usage.

Options considered for *how cleanup happens at all*:
1. A scheduled job (cron/worker) that periodically deletes expired rows.
2. Delete opportunistically as a side effect of the code that already writes to the table.

Options considered for *when the delete in option 2 runs*:
1. Inline, in the same request/transaction as issuing the new code — simplest, but the DELETE adds latency to every successful `/auth/otp/request` call, worse the more traffic that endpoint sees.
2. Deferred to a FastAPI `BackgroundTasks` callback, so it runs after the response is already sent to the caller.

Options considered for *how often it actually runs*, once deferred to a background task:
1. Every single successful request — simplest, but under heavy traffic this means far more sweeps than the retention window (24h) needs; each one is cheap on its own (indexed DELETE, see below) but the cost still scales with request volume for no benefit, since the table doesn't need sweeping that often.
2. A real scheduled job (e.g. a Render Cron Job every 5 minutes) — decouples frequency from request volume entirely, but is a new service to provision, deploy, and monitor, for a project that currently runs one web service + managed Postgres and nothing else ([ADR-0005](0005-render-deployment-topology.md)), pre-launch, with no actual load yet to justify it.
3. Gate the background task with an in-process throttle: only actually schedule the DELETE if enough time has passed since the last one, tracked the same way the rate limiter and cache track their own per-process state.

## Decision

Option 2 for "when", option 3 for "how often": `request_otp` calls `cache.throttle(request.app, "otp_cleanup:sweep", OTP_CLEANUP_MIN_INTERVAL_SECONDS)` (`backend/app/core/cache.py`) and only schedules `_cleanup_expired_otp_codes` via `BackgroundTasks.add_task` if that returns `True` — giving the same practical cadence as a 5-minute cron (`OTP_CLEANUP_MIN_INTERVAL_SECONDS = 300`) without a scheduler. The task itself deletes `otp_codes` rows past `OTP_CODE_RETENTION_HOURS` (24h), committing on its own since the request has already returned its response by the time it runs. FastAPI closes a `yield`-based dependency (here, the DB session from `get_db`) only after background tasks finish, so reusing the request's `db` session here is safe. No new scheduled job, no new service.

`cache.throttle` is deliberately a general-purpose addition to `cache.py`, not something private to this endpoint — see CLAUDE.md → Data Layer Conventions, which now calls out gating opportunistic/periodic maintenance work as its own standing rule, for whatever the next case like this is.

Added `ix_otp_codes_expires_at` (`backend/app/models/otp_code.py`) so the cleanup's `WHERE expires_at < cutoff` isn't a sequential scan — the existing `(email, created_at)` composite index (added for the request-rate-limit and latest-code lookups) doesn't cover it, since that query has no `email` predicate.

## Consequences

- Zero new infrastructure, zero new cost, consistent with this project's stated preference for a small infrastructure surface ([ADR-0002](0002-modulith-over-microservices.md), [ADR-0005](0005-render-deployment-topology.md), [ADR-0007](0007-in-memory-per-ip-rate-limiting.md)).
- Cleanup is opportunistic, not exact, in two compounding ways: it only runs when *someone, anywhere* requests a new code, and even then only if the throttle window has elapsed. A quiet period (or one within the throttle window) leaves stale rows sitting past their retention window a bit longer than 24h — acceptable, since the goal is bounding long-run growth, not enforcing a precise deletion SLA. If the app ever gains a real scheduler for other reasons (a Render Cron Job, a worker), this is the first candidate to move there instead — not a reason to add one preemptively just for this.
- Resets on restart/redeploy the same way the rate limiter and cache do (ADR-0007, [ADR-0009](0009-in-process-cache-for-question-catalog.md)): a mid-cleanup crash, or a redeploy that clears the throttle's last-run timestamp, just means the next successful request tries again (immediately, since the throttle resets too) — not a correctness problem.
- Running cleanup as a background task means the caller of `/auth/otp/request` never waits on it. The throttle is what actually bounds total DB load under heavy traffic — without it, the DELETE would still run once per successful request, just without blocking the response.

## Addendum (2026-09-17)

`OTP_CLEANUP_MIN_INTERVAL_SECONDS` and `OTP_CODE_RETENTION_HOURS`, written above as fixed constants, are now optional env vars on `Settings` (`backend/app/core/config.py`) with those values as defaults. The same throttled-sweep pattern is also used by the rate limiter to drop idle per-IP counters (see ADR-0007's addendum). The claim that FastAPI closes the request's `yield` dependencies only after background tasks finish was re-checked against the installed FastAPI (0.141) and still holds for the default dependency scope.
