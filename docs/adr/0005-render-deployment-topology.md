# 0005. Render deployment topology

Status: Accepted

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
