# 0015. Frontend deployment topology: subdomain split on Render

Status: Accepted

## Context

[ADR-0005](0005-render-deployment-topology.md) provisioned one Render web service for the backend and explicitly deferred the frontend: "No frontend service yet — added when the frontend exists." The frontend now exists (landing/login/start, per [ADR-0013](0013-frontend-architecture-and-tooling.md)) and needs to go live under `sks-lotse.de`, which is currently a Custom Domain on the backend service directly (`CLAUDE.md` → Naming/Domain).

[ADR-0012](0012-httponly-cookie-for-frontend-session-token.md) assumed the frontend would be served same-site with the API — "`sks-lotse.de` itself or a subdomain of it" — and flagged that assumption for revisiting once the frontend's deployment was actually decided. This is that decision.

Render's two service types relevant here are a **Static Site** (for the built frontend — no server-side runtime) and the existing **web service** (Python, for the backend). Static-site "rewrite" rules only remap paths *within that same site* (e.g. the SPA fallback `/* → /index.html`) — confirmed against Render's docs, they cannot proxy a path like `/api/*` to a different Render service. So a static site and the backend cannot share one literal origin on Render without collapsing them into a single deployed service.

Options considered:
1. **Subdomain split**: a new Render Static Site takes `sks-lotse.de`/`www.sks-lotse.de`; the backend gets a new `api.sks-lotse.de` Custom Domain. Same-site, not same-origin — the exact fallback ADR-0012 anticipated.
2. **Single service**: the backend serves the built frontend as static files (e.g. via `StaticFiles`), so everything stays on one origin with no new service or subdomain. Genuinely same-origin, but couples the two deploys together, and needs Node available during the backend's build (Render's Python runtime doesn't include it — likely forcing a Dockerfile instead of the native buildpack), working against ADR-0013's separately-scaffolded, separately-deployable frontend.
3. **Different origins**: frontend on `sks-lotse.de`, backend stays on its default `onrender.com` URL — least new infra, but breaks the current `SameSite=Lax` cookie (not sent cross-site), forcing `SameSite=None` + a CSRF story ADR-0012 explicitly avoided needing by assuming same-site.

## Decision

**Subdomain split** (option 1): a new `sks-lotse-frontend` Render Static Site (`render.yaml`) takes over the `sks-lotse.de` and `www.sks-lotse.de` Custom Domains, moved off the backend service. The backend keeps `sks-lotse.com`/`www.sks-lotse.com` unchanged (still 301s to `.de` via `RedirectSecondaryDomainsMiddleware`) and gains a new `api.sks-lotse.de` Custom Domain, which is what the frontend calls (`VITE_API_BASE_URL`, baked in at build time).

This needs no backend code changes: the session cookie is already host-only (no explicit `Domain` attribute) with `SameSite=Lax`, and a request from `sks-lotse.de` to `api.sks-lotse.de` is same-site (same registrable domain) even though it's cross-origin — `SameSite=Lax` only restricts genuinely cross-site requests, so the cookie is sent normally. CORS in production already allow-lists `https://sks-lotse.de` and `https://www.sks-lotse.de` (`backend/app/core/config.py`), which is the frontend's origin under this topology too.

Custom Domain attachment and the IONOS DNS changes are manual, account-owner steps — same category as the ones already listed under `CLAUDE.md` → Deployment (Render) → "One-time manual steps" — not something done from `render.yaml` alone.

## Consequences

- Two independently deployable Render services, matching how the frontend and backend are already two independently deployable codebases (ADR-0013) — a frontend-only change doesn't redeploy the backend and vice versa.
- The frontend and API are cross-origin (different subdomains), not same-origin — CORS stays load-bearing (it already was). A future endpoint that assumes same-origin (e.g. relying on browser same-origin defaults instead of explicit CORS config) would need to account for this.
- `VITE_API_BASE_URL` is baked in at build time (Vite inlines `import.meta.env` values into the bundle) — changing the API's public URL means a new frontend build/deploy, not just a config toggle.
- Rejected: single service serving both (option 2) — revisit only if the two-service split becomes a real operational burden; not the case at this scale.
- Rejected: different, non-same-site origins (option 3) — would have required reopening ADR-0012's `SameSite=Lax` decision and its CSRF reasoning for no real benefit here, since the subdomain split avoids that entirely.
- If `sks-lotse.global` or `sks-lotse.store` are ever wired up (currently unused, see `CLAUDE.md` → Naming/Domain), each needs its own decision about which service it points to — not addressed here.
