# 0042. Manual maintenance mode via a Render-only env var toggle

Status: Accepted

## Context

During a production malfunction, the operator needs to shut off ordinary usage quickly and predictably while investigating, without depending on the app's own `/admin` UI — it may be affected by the same malfunction — and without a staging environment to rehearse the toggle against ([ADR-0005](0005-render-deployment-topology.md)). Legal pages (Impressum, Datenschutzerklärung, AGB) must stay reachable throughout (§5 DDG Impressumspflicht). The existing pattern for an operator-tunable runtime setting without a redeploy ([ADR-0036](0036-weekly-ai-check-budget-with-admin-overrides.md), a DB-backed value edited via `/admin/settings`) was deliberately not reused here, since it's gated behind the same `/admin` UI this needs to be independent of.

## Decision

- A boolean `MAINTENANCE_MODE` setting (`backend/app/core/config.py`), `sync: false` in `render.yaml` on the backend service only, read once at process start like every other `Settings` field — no live reload, so a flip always costs a redeploy.
- `MaintenanceModeMiddleware` (`backend/app/core/maintenance.py`), wired ahead of `RateLimitMiddleware` but still inside `CORSMiddleware`/`RequestIdMiddleware`, returns `503` with an `X-Maintenance-Mode: 1` header for every `/api/v1/*` request; `/health` is untouched, so Render's own reachability check and the uptime monitor keep working. `CORSMiddleware` explicitly exposes that header (`expose_headers`) — without it, a cross-origin browser hides custom response headers from JS by default, and the frontend would never see it.
- The frontend (`frontend/src/api/client.ts`) checks every API response for that header via the same handler-registration pattern already used for 401s, and stores the flag in a new `maintenanceStore`. `App.tsx` gates the whole route tree on it, except `/imprint`, `/privacy` and `/agb`.
- Toggling happens only from outside the running app: directly in the Render dashboard (which redeploys itself on save), or via a `workflow_dispatch` GitHub Action (`.github/workflows/maintenance-mode.yml`) that calls Render's API to set the same env var and trigger a deploy.

## Consequences

- A flip always costs a full backend redeploy — on the order of a minute, never instant. Fine for a deliberate operator action, not a fit for automated incident response.
- Because every non-exempt route unmounts while the flag is on, nothing else would ever call the API again to notice maintenance mode has ended — `MaintenancePage` has to offer an explicit "Erneut prüfen" retry (re-running the session check) rather than relying on some other component's next call, or an already-open tab would stay stuck until a manual reload.
- The mechanism only protects `/api/v1`. If the static frontend itself is what's malfunctioning, this doesn't help — a Render rollback of the frontend service is the lever there, unchanged.
- All-or-nothing and not schedulable: no per-feature or scheduled maintenance windows. Extending to either would need a rethink.
- Rejected alternative: a Render Static Site rewrite (`/* → /maintenance.html`) instead of a backend flag. Would work even if the JS bundle itself failed to load, but can't distinguish the exempt legal routes without duplicating routing logic outside the SPA, and — since it only affects new page loads — doesn't block an already-open tab any better than the chosen approach does.
