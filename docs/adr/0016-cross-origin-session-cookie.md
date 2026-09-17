# 0016. Cross-origin session cookie: SameSite=None, calling the backend's default Render URL

Status: Accepted — supersedes [ADR-0015](0015-frontend-deployment-topology.md)

## Context

[ADR-0015](0015-frontend-deployment-topology.md) planned a subdomain split: the frontend on `sks-lotse.de`, the backend on a new `api.sks-lotse.de` Custom Domain, kept same-site per [ADR-0012](0012-httponly-cookie-for-frontend-session-token.md)'s assumption. Rolling it out surfaced a constraint neither ADR anticipated: the Render account's plan caps **custom domains at 2, total for the whole account** — not 2 per service, as ADR-0015 assumed — and each domain's `www` variant is included automatically, not a separate slot. `sks-lotse.de` (frontend) and `sks-lotse.com` (backend) already spend both slots; there is no room for a third domain like `api.sks-lotse.de` without either upgrading the plan or dropping one of the two existing domains.

The backend is, however, always reachable at its default `https://sks-lotse-backend.onrender.com` URL at no cost and no domain slot — Render's "Render Subdomain" option, on by default.

Options considered:
1. **Drop `sks-lotse.com`**, use that slot for `api.sks-lotse.de`, keep the same-site design from ADR-0012/0015 intact. Loses the live `.com` → `.de` redirect (`sks-lotse.com` becomes purchased-but-unwired, like `.global`/`.store` already are) until the plan is upgraded or another slot frees up.
2. **Frontend calls the backend's default `onrender.com` URL directly.** No new domain needed, `sks-lotse.com` keeps its slot and its redirect — but `sks-lotse.de` and `onrender.com` are different registrable domains, so this is genuinely cross-*site*, not just cross-origin. The `SameSite=Lax` cookie ADR-0012 chose is not sent on this kind of cross-site request at all, breaking login outright.
3. **Upgrade the Render plan** for a third domain slot. A real billing decision, not something to default into for an MVP with no revenue yet.

## Decision

**Option 2**: the frontend calls the backend at its default `https://sks-lotse-backend.onrender.com` URL (`render.yaml`'s `VITE_API_BASE_URL`). `sks-lotse.com` keeps its Custom Domain slot and its redirect to `.de`, unchanged.

This makes the session cookie genuinely cross-site, so `backend/app/api/v1/auth.py` changes `SameSite=Lax` to `SameSite=None`. Per spec, browsers reject a `SameSite=None` cookie outright unless it's also `Secure` — so `Secure` is now unconditional (previously `secure=settings.is_production`, since `SameSite=Lax` didn't require it and local dev ran over plain `http://`). This still works locally: modern browsers treat `http://localhost` as a secure context, so a `Secure` cookie is set and sent there without TLS.

`SameSite=None` reopens the CSRF question ADR-0012 avoided by assuming same-site. Re-examined here: the API is JSON-only, and a browser `<form>` (the classic CSRF vector) cannot set `Content-Type: application/json` — only `application/x-www-form-urlencoded`, `multipart/form-data`, or `text/plain`, none of which this API's endpoints accept as valid request bodies. A cross-site `fetch`/XHR with a JSON body would work as an attack in principle, but any credentialed cross-origin `fetch` first triggers a CORS preflight, and `backend/app/core/config.py`'s `cors_allowed_origins` only allow-lists the real frontend origins in production (never `*`) with `allow_credentials=True` — a request from an attacker's origin fails preflight and the browser never sends it. No CSRF token is introduced; the existing JSON-only-API + strict-CORS-allowlist combination is judged sufficient.

## Consequences

- No new Render Custom Domain or DNS record needed for the API — one less moving part than ADR-0015's plan.
- If the API's public URL ever needs to change (e.g. moving off `onrender.com` later), that's a `render.yaml` env var + frontend rebuild, same as it already was under ADR-0015's plan.
- The CSRF-mitigation argument above depends on the API staying JSON-only and the CORS allowlist staying an explicit, non-wildcard origin list with credentials — a future endpoint that relaxes either (e.g. accepting form-encoded bodies, or loosening CORS) would need to re-examine this.
- ADR-0015 is superseded: its `api.sks-lotse.de` subdomain and the "drop `www.sks-lotse.com`" addendum it grew during rollout are both moot — `www.sks-lotse.com` was never actually removed in Render, and `SECONDARY_HOSTS` (`backend/app/core/canonical_domain.py`) keeps it.
- If the Render plan is ever upgraded (e.g. for other reasons), revisit: a same-site `api.sks-lotse.de` subdomain per ADR-0015 is the more conventional setup and would let `SameSite` move back to `Lax`.
