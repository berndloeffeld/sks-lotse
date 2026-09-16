# 0007. In-memory, per-IP rate limiting instead of Redis or a reverse proxy

Status: Accepted

## Context

The email+OTP login flow ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) needed abuse protection: a per-email cooldown/hourly cap (`backend/app/core/otp.py`) stops one inbox from being spammed, but doesn't stop a caller from spraying OTP requests across many different (random or throwaway) email addresses, running up the Resend bill regardless of any single target. The same class of protection — a generous per-IP request cap — is also generally useful across the rest of the API (`/api/v1/questions` etc.), not just the OTP endpoint.

Options considered for *where the counters live*:
1. **In-process memory** (a dict on the FastAPI app, reset on restart).
2. **Redis** (Render's managed Key Value offering, or a third-party host like Upstash) — the conventional choice for rate limiting that must survive restarts and stay correct across multiple app instances.
3. A dedicated **reverse proxy in front of the app** (e.g. nginx with `limit_req_zone`), doing IP-based limiting before requests even reach Python.

Options considered for *how limits are declared*:
1. Hard-code the check inline in each route that needs it.
2. A small, generic middleware with a rule table (`{path: (limit, window)}` plus an optional default rule scoped by path prefix), so new endpoints opt in without new code.

## Decision

- **In-memory counters** (`backend/app/core/rate_limit.py`), not Redis. The project runs a single Render instance with no staging environment ([ADR-0005](0005-render-deployment-topology.md)), so there is no multi-instance correctness problem to solve, and no existing need for a shared cache elsewhere that would make adding Redis close to free. Introducing it now would mean the first paid or third-party-hosted infrastructure dependency in the project purely to serve this one concern.
- **No reverse proxy.** Render already terminates TLS and routes traffic in front of the app; standing up nginx (or any proxy) in front of a Render-native Python service means either switching the service to a custom Docker image or running a second Render service — both meaningfully more moving parts than this project's stated preference for a modulith / single service ([ADR-0002](0002-modulith-over-microservices.md), ADR-0005). It would also only cover the IP-based half of the protection — the per-email logic still has to read the request body and query the database, so it stays application code regardless.
- **A generic middleware**, not per-route checks: `RateLimitMiddleware` takes exact-path overrides (`rules`) and an optional `default_rule` applied to any path under a `scope_prefix`. `/auth/otp/request` gets its own tighter cap (20 requests/hour/IP); everything else under `/api/v1` gets a generous shared cap (300 requests/5 min/IP) via the default rule. `/health` is deliberately outside `scope_prefix`, since Render's own reachability checks hit it directly and must never be throttled.

## Consequences

- Counters reset on every restart or redeploy, and each instance would enforce its own limit independently if the project ever ran more than one — both acceptable for now, not hard guarantees. This is a real ceiling to revisit if Render's free-plan instance starts idling/restarting often enough to meaningfully weaken the limits, or if the project moves to more than one instance.
- No new third-party account, no new secret, no new cost — consistent with keeping the infrastructure surface small for a solo-maintained MVP.
- The middleware is intentionally reusable: a future endpoint (e.g. the LLM grading call) can add its own tighter `rules` entry, or just rely on the shared `default_rule`, without touching this file's structure again.
- If the topology assumptions above change (multiple instances, or restarts frequent enough to matter), the fix is additive — swap the in-memory `_hits_for` store for a Redis-backed one behind the same `RateLimitMiddleware` interface — not a rewrite.
