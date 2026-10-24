# 0069. The frontend split into shared, SKS and SBF; SBF Lotse reaches the API through a proxy on sbf-lotse.de

Status: Accepted — amends [ADR-0067](0067-second-site-from-one-codebase.md) (where each site's code lives; the cross-site question its Consequences left open for increment 2); the proxy is withdrawn after its check failed (update 2026-10-24 below) and superseded by [ADR-0070](0070-sbf-lotse-api-on-api-sbf-lotse-de.md) (api.sbf-lotse.de)

## Context

[ADR-0067](0067-second-site-from-one-codebase.md) builds SKS Lotse and SBF Lotse from one `frontend/`. After the first increment, the SBF code sat in `src/sbf/`, but everything else sat flat in `src/`. Nothing in the layout told what both sites use from what only SKS Lotse uses:
- About 35 modules of `src/` were used by both builds (header bar, page shell, footer, modal, legal content, the site identity), some 130 only by SKS Lotse.
- Three modules mixed the two: `publicPages.ts` (the SKS pages and the prerender's helpers both sites use), `faq.ts` (the SKS FAQ and the link syntax both use) and `runVerdict.ts` (the SBF pass mark and the SKS chart verdict).
- Only `scripts/check-sbf-build.mjs`, after a full SBF build, caught a shared part that pulled in SKS code. It catches the API client and the SKS data chunks, nothing else.

Increment 2 brings accounts to SBF Lotse. Login, the API client and the auth store will then be needed by both sites. Before that, the boundary should be visible and enforced, so moving a part into the shared code is a deliberate step.

ADR-0067 also left a question open: the session cookie is `SameSite=Lax` and host-only on api.sks-lotse.de ([ADR-0012](0012-httponly-cookie-for-frontend-session-token.md)). sks-lotse.de is same-site with it; sbf-lotse.de is not, so the browser would not send it. Options considered for the API call from sbf-lotse.de:
1. **api.sbf-lotse.de**, a second custom domain on the same backend service. Same-site again, the cookie stays as it is. Needs CORS for the SBF origins and a DNS record.
2. **A `SameSite=None` cookie** on api.sks-lotse.de. A third-party cookie: Safari and Firefox block it by default, Chrome restricts it. The login would not hold for many learners.
3. **A proxy under sbf-lotse.de**: the static site rewrites `/api/*` to the backend. To the browser the API is the page's own origin, so the cookie is first-party, host-only on sbf-lotse.de.

## Decision

**The directory split.** `frontend/src/` has three areas, plus the test setup:
- `src/shared/`: what both sites use. Components, hooks, the legal content, the site identity (`site.ts`, `siteConfig.ts`), analytics, `index.css`, the prerender's helpers (`publicPages.ts`: page head, sitemap, FAQ structured data) and the FAQ link syntax (`faq.ts`).
- `src/sks/`: SKS Lotse. Its entry, routes, pages, the API client and its types, the auth store, its data exports (`src/sks/data/`).
- `src/sbf/`: SBF Lotse. Its entry, routes, pages, the Navigationsaufgaben, their export (`src/sbf/data/`) and their pass mark (`runVerdict.ts`).
- `src/test/`: the test setup and fixtures.

Within each area the subfolders stay as they were (`components/`, `hooks/`, `pages/`, …). A module goes to `shared/` only once both sites use it; until then it stays with its site. The mixed modules were split along that line (the SKS chart verdict is now `src/sks/chartVerdict.ts`).

**The boundary is a lint rule.** `no-restricted-imports` in `eslint.config.js`: `src/shared/` imports neither site, `src/sks/` not `src/sbf/`, `src/sbf/` not `src/sks/`. `npm run lint` fails on such an import, in the editor and in the required `frontend-lint` job, before any build. `check-sbf-build.mjs` stays: it checks the built output, which the lint rule cannot.

**SBF Lotse reaches the API through a proxy on sbf-lotse.de (option 3)**, from increment 2 on:
- `sbf-lotse-frontend` in `render.yaml` gets a rewrite of `/api/*` to `https://api.sks-lotse.de/api/*`, before the SPA fallback.
- The SBF build calls the API on its own origin (`/api/v1/...`). Its CSP keeps `connect-src 'self'`, and no CORS is needed for it.
- The session cookie is set on sbf-lotse.de, `SameSite=Lax`, httpOnly, as ADR-0012 describes. A learner signs in on each site separately; the accounts are the same.
- Admin stays on sks-lotse.de; the SBF build gets no admin pages.

## Consequences

- Where a module belongs is visible from its path. Moving one into `shared/` is a commit of its own, and the lint rule names what still points across.
- Increment 2 moves the session parts (API client, auth store, login) from `src/sks/` to `src/shared/` as SBF Lotse starts using them. ADR-0067's rule "SBF Lotse makes no API call" then ends; `check-sbf-build.mjs` changes from "no API call" to "no SKS page and no SKS data".
- Paths outside the frontend changed with the move: the backend's export scripts write to `src/sks/data/` and `src/sbf/data/`, the Postman script to `src/sks/api/schema.gen.ts`, and the mutation scope lists the new paths.
- **To verify before the proxy goes live** (first step of increment 2; the rewrite is deployed ahead of it for that, and `scripts/check_sbf_proxy.sh` runs the checks):
  - **The client IP.** The per-IP rate limit and the OTP lockouts trust only `CF-Connecting-IP`/`True-Client-IP` and never `X-Forwarded-For` ([ADR-0007](0007-in-memory-per-ip-rate-limiting.md), `app/core/rate_limit.py`). Behind Render's rewrite, these headers may carry the CDN's address instead of the learner's. Then every SBF learner would share one bucket, and a single caller could lock out all of them. This has to be measured on the real setup. If no trustworthy header carries the learner's IP, this decision is reopened, with option 1 as the fallback.
  - **Cookies and headers through the rewrite**: `Set-Cookie`, `Cookie` and the request body pass unchanged; the backend's security headers arrive.
  - **Which site a request is from.** Mail links and Stripe's return URLs use `cors_allowed_origins[0]` today, which is always sks-lotse.de. The backend has to build them for the site the request came from (by its `Origin`, checked against a list), or a learner from sbf-lotse.de lands on sks-lotse.de.
- The rewrite's target is fixed in `render.yaml`; Render cannot fill it from another service's address, which is fine with one production environment.
- One more hop per API call from sbf-lotse.de, through Render's CDN. Negligible next to the Lotsen-Check's latency.
- Rejected:
  - api.sbf-lotse.de (option 1): a second API host and CORS origin to run, for the same result. It stays the fallback, should the client IP not come through the proxy.
  - A `SameSite=None` cookie (option 2): blocked as a third-party cookie in Safari and Firefox.
  - Leaving `src/` flat and relying on `check-sbf-build.mjs`: it only sees what reaches the SBF bundle, after a full build, and says nothing about SKS code that only SBF should not depend on.

## Update 2026-10-24: the proxy check failed, the rewrite is removed

The rewrite was deployed ahead of increment 2 and checked from one network against production (`POST /api/v1/auth/otp/verify-link` with a dummy token, limit 30 an hour per IP):
- **Reachability**: through sbf-lotse.de the backend answered (JSON, its `x-request-id`).
- **Not the learner's IP**: with this network's bucket full directly on api.sks-lotse.de (429, over IPv4 and IPv6), the same request through sbf-lotse.de got 401. The backend saw another IP.
- **No shared bucket either**: more than 40 requests through sbf-lotse.de within minutes, none got 429. The requests arrive from changing CDN addresses, so the rewrite **bypassed the per-IP rate limit** for anyone who used it, the OTP routes included.
- **No spoofing**: a client-sent `CF-Connecting-IP` is refused by Cloudflare (403), and a client-sent `True-Client-IP` doesn't reach the limiter.

So the rewrite came out of `render.yaml` again the same day, and `tests/test_render_blueprint.py` now fails on any `/api` rewrite. The per-email limits (code requests, attempts per code) held throughout; only the per-IP limits were open.

The cross-site question is open again. The fallback named above, api.sbf-lotse.de, is decided in [ADR-0070](0070-sbf-lotse-api-on-api-sbf-lotse-de.md). The directory split above stands.
