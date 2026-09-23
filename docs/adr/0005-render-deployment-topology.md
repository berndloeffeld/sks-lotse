# 0005. Render deployment topology

Status: Accepted — the "no frontend service yet" part is superseded by [ADR-0015](0015-frontend-deployment-topology.md)

## Context

The domains are registered (see `CLAUDE.md` → Naming / Domain) and the backend is functional enough to deploy. `CLAUDE.md` already named Render (Frankfurt EU) as the hosting target; what was still open is the actual service topology: how many services, whether to provision by hand or as code, and whether to stand up a staging environment now.

Options considered for provisioning:
1. Manually click through the Render dashboard to create each service.
2. A `render.yaml` Blueprint — infrastructure as code, reviewed via the same PR flow as everything else, reproducible if a service needs to be recreated.

Options considered for environments:
1. Production only.
2. Staging + production.

## Decision

- **One Render web service** for the backend (`sks-lotse-backend`, Python runtime, Frankfurt region, free plan) plus **one managed Postgres** (`sks-lotse-db`, free plan, Frankfurt) — no separate services yet, consistent with [ADR-0002](0002-modulith-over-microservices.md). No frontend service yet — added when the frontend exists.
- Provisioned via **`render.yaml` Blueprint** (repo root), not manual dashboard clicks — connecting the repo and clicking "Deploy from Blueprint" in Render is a one-time manual step (requires the account owner's login), everything after that is code.
- Migrations run inline as part of `startCommand` (`alembic upgrade head && uvicorn ...`) — `preDeployCommand` would be the cleaner mechanism (runs after build, before the new version serves traffic) but isn't available on Render's free plan. `alembic upgrade head` is idempotent, so running it on every start is safe, just not as clean as a dedicated pre-deploy step. Revisit if upgrading off the free plan.
- Secrets (`JWT_SECRET`, `OPENAI_API_KEY`, `ADSENSE_CLIENT_ID`) are declared with `sync: false` in the Blueprint — present as keys so their existence is documented, but values are set once in the Render dashboard, never committed. `DATABASE_URL` is wired automatically via `fromDatabase`.
- Auto-deploy on every commit to `main` (`autoDeployTrigger: commit`) — matches the trunk-based branch strategy in `CLAUDE.md`.
- **Production only, no staging environment** for now.

## Consequences

- Recreating the infra (e.g. after an account issue, or to inspect the exact config) is a Blueprint re-deploy, not tribal knowledge of dashboard clicks.
- No staging means every merge to `main` goes straight to what users would see — acceptable pre-launch with no real users yet, but means CI (tests, lint, Aikido) is the only safety net before something goes live. Revisit once there are actual users who'd be affected by a bad deploy.
- Free-plan Postgres and web service both have real limits (the DB free plan in particular is time-limited/small) — fine for MVP validation, but this ADR doesn't cover the upgrade path; revisit when free-plan limits are actually hit rather than pre-optimizing now.
- The Blueprint's `sync: false` secrets still require a manual one-time step per environment (entering them in the dashboard) — this ADR doesn't eliminate that, only avoids committing the values.

## Addendum (2026-09-17)

Current state, for readers comparing this record with `render.yaml`: the `sync: false` secrets now also include `RESEND_API_KEY` and `ALLOWED_EMAILS` (added with email+OTP login), the service declares `healthCheckPath: /health`, and `PYTHON_VERSION` is pinned explicitly in the Blueprint (Render ignored `backend/runtime.txt`, which has since been removed in favor of `/.python-version`). The topology decision itself is unchanged.

A frontend service (`sks-lotse-frontend`, Static Site) has since been added to `render.yaml` — see [ADR-0015](0015-frontend-deployment-topology.md) for that decision; this ADR's "no frontend service yet" line is superseded by it.

## Addendum (2026-09-20, paid plans)

The backend moved to the `starter` plan and the database to `basic-256mb` (`render.yaml`), ahead of real use: a free Postgres expires after 30 days and has no backups, and a free web service spins down when idle. `ALLOWED_EMAILS` is no longer set in production (the private beta is over). Migrations still run inline in `startCommand`; `preDeployCommand` is now available and would abort a deploy on a failed migration instead of crash-looping — a candidate for a follow-up. Operations: Render's log stream forwards to Better Stack (log-based error alert, uptime monitors on `/health` and the frontend); the database has no connection pool (single backend instance, SQLAlchemy pool is enough).

## Addendum (2026-09-22)

- **Migrations moved to `preDeployCommand`**, and `startCommand` runs only uvicorn: a failed migration now aborts the deploy while the old instance keeps serving, instead of the new one crash-looping.
- **Exactly one uvicorn worker** (`--workers 1`, explicit so `WEB_CONCURRENCY` can't raise it), with a 25 s graceful-shutdown window. The in-memory rate limiter, catalog cache and AI-check caps assume one process (ADR-0007, ADR-0009).
- **`autoDeployTrigger: checksPass`** on all services: a commit deploys only once its GitHub checks passed, not while CI for it is still running.
- `OPENAI_API_KEY` and `ADSENSE_CLIENT_ID` are removed from the backend. Grading went to Anthropic (ADR-0031, `ANTHROPIC_GRADING_API_KEY`), and the AdSense id is only needed at frontend build time (`VITE_ADSENSE_CLIENT_ID`). The secrets list above is historical.
- **Structured logs**: `LOG_FORMAT=json` on the backend and the cron job, for Better Stack (see `docs/ARCHITECTURE.md` → Deployment → Logs).
- The database keeps accepting external connections (no `ipAllowList`), a deliberate choice so the operator can reach it directly. Access is protected by the generated password only.
- **PostgreSQL 18** is what production actually runs (Render's default when the database was created). CI and docker-compose had tested against 16, so migrations were never exercised on the production version. All three now use 18, and `render.yaml` pins `postgresMajorVersion: "18"`.

## Addendum (2026-09-23, closing external database access)

The previous addendum's "keeps accepting external connections" is superseded: `render.yaml` now sets `ipAllowList: []` on `sks-lotse-db`. This followed adding the admin tools that covered the lookups direct SQL access was for — browsing and searching accounts (`GET /admin/users`) and question/answer texts (`GET /admin/questions`), alongside the GDPR lookup/export/delete already there (ADR-0019). An empty `ipAllowList` blocks external clients only; services within the same Render account (the backend, the cron job) still reach the database over its internal network, so nothing about the running app changes. Emergency ad hoc access that the admin UI doesn't cover goes through the backend service's Render Shell instead of a local `psql` (see `docs/RUNBOOK.md` → Database).
