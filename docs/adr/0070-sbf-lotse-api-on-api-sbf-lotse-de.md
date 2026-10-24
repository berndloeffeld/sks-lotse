# 0070. SBF Lotse reaches the API on api.sbf-lotse.de

Status: Accepted — supersedes the proxy part of [ADR-0069](0069-frontend-split-and-sbf-api-through-a-proxy.md) (how sbf-lotse.de reaches the API from increment 2)

## Context

From increment 2, learners sign in on sbf-lotse.de. The session cookie is `__Host-access_token`, httpOnly, `SameSite=Lax`, with no `Domain`, so it belongs to the API host that set it ([ADR-0012](0012-httponly-cookie-for-frontend-session-token.md)). The browser only sends it with a request from a page on the same site as that host. sbf-lotse.de is not same-site with api.sks-lotse.de.

[ADR-0069](0069-frontend-split-and-sbf-api-through-a-proxy.md) chose a rewrite of `sbf-lotse.de/api/*` to the backend. It was measured against production on 2026-10-24 and failed. Behind Render's rewrite the requests arrive from changing CDN addresses, so the per-IP rate limit ([ADR-0007](0007-in-memory-per-ip-rate-limiting.md)) neither saw the learner nor held any caller back. The rewrite was removed (ADR-0069, update 2026-10-24). A `SameSite=None` cookie stays out, since Safari and Firefox block third-party cookies.

## Decision

**The backend service gets a second custom domain, api.sbf-lotse.de**, beside api.sks-lotse.de. The SBF build calls the API there.
- **The domain:** a CNAME `api` → `sks-lotse-backend.onrender.com` at IONOS, verified on Render on 2026-10-24, with its certificate issued. It is the same service, database and accounts, with no second backend.
- **Same-site again:** sbf-lotse.de and api.sbf-lotse.de share the registrable domain. The `SameSite=Lax` cookie works as on SKS Lotse, unchanged.
- **The rate limit sees the learner:** requests reach the backend directly through Render's Cloudflare, like those to api.sks-lotse.de. Measured on 2026-10-24: once this network's default bucket was full directly on api.sks-lotse.de (the first 429 at request 301), api.sbf-lotse.de answered 429 too, from the same bucket.
- **A session per site:** the cookie belongs to the API host that set it. A learner signs in on each site separately, with the same account. That fits two brands, and no cookie is shared across domains.

What increment 2 adds for it, none of it before:
- **CORS:** the SBF origins (`https://sbf-lotse.de`, `https://www.sbf-lotse.de`) in `cors_allowed_origins`.
- **The SBF build:** `VITE_API_BASE_URL=https://api.sbf-lotse.de`, and the host in its CSP `connect-src`. `backend/tests/test_render_blueprint.py` then expects that host instead of "no API".
- **Links per site:** mail links and Stripe's return URLs are built for the site the request came from, by its `Origin` checked against the allowed origins, not from `cors_allowed_origins[0]` as today.

## Consequences

- Each API host serves every route. api.sks-lotse.de is meant for sks-lotse.de and api.sbf-lotse.de for sbf-lotse.de, but nothing enforces that beyond CORS. That is fine, since the API is public either way and its guards don't depend on the host.
- The backend service now has four custom domains. The dashboard still reads "2 / 2 included", so whether the extra one costs is a question of the Render plan. sks-lotse.com and www only redirect to sks-lotse.de, and could move elsewhere should the slots matter.
- Admin stays on sks-lotse.de. A session made on sbf-lotse.de is a learner's session, and the admin pages aren't in the SBF build.
- Until increment 2 the domain answers but nothing calls it: the SBF build has no API base URL and its CSP allows no API host.
- Rejected:
  - The proxy on sbf-lotse.de: it hid the caller's IP from the rate limit (ADR-0069).
  - A `SameSite=None` cookie on api.sks-lotse.de: blocked as a third-party cookie in Safari and Firefox.
