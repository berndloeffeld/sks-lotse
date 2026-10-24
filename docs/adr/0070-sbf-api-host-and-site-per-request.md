# 0070. SBF Lotse reaches the API on api.sbf-lotse.de; the backend tells the site per request

Status: Accepted — amends [ADR-0012](0012-httponly-cookie-for-frontend-session-token.md) (one session cookie per API host, so a learner signs in on each site once), [ADR-0048](0048-stripe-hosted-checkout-with-webhook-fulfilment.md) (the site goes into the Checkout Session's metadata) and [ADR-0069](0069-frontend-split-and-sbf-api-through-a-proxy.md) (its fallback, api.sbf-lotse.de, replaces the withdrawn proxy), and [ADR-0067](0067-second-site-from-one-codebase.md) ("SBF Lotse makes no API call" ends with accounts in its build, update 2026-10-24 below)

## Context

Increment 2 brings accounts to SBF Lotse. [ADR-0069](0069-frontend-split-and-sbf-api-through-a-proxy.md) chose a proxy on sbf-lotse.de for the API calls. Its check against production failed: behind the rewrite, the backend didn't see the learner's IP, so the per-IP rate limit didn't hold (update 2026-10-24 there). The rewrite came out again, and the cross-site question was open.

What still holds from ADR-0069's options:
- **The session cookie** is `__Host-access_token`, httpOnly, `SameSite=Lax`, host-only on the API host ([ADR-0012](0012-httponly-cookie-for-frontend-session-token.md)). The browser sends it only from a page on the same site. sbf-lotse.de and api.sks-lotse.de are not the same site.
- **A `SameSite=None` cookie** is a third-party cookie, blocked by default in Safari and Firefox.
- **The fallback** ADR-0069 names: a second custom domain on the backend service, **api.sbf-lotse.de**. It is same-site with sbf-lotse.de, since they share the registrable domain. Set up on 2026-10-24: a `CNAME api → sks-lotse-backend.onrender.com` at IONOS, verified on `sks-lotse-backend` on Render, with its certificate issued. The same service, database and accounts, no second backend.

The backend also has to know which site a request is from. Until now:
- Every link it built (the login link, the mail footers, Stripe's return URLs) used `cors_allowed_origins[0]`, always sks-lotse.de.
- Every mail said "SKS Lotse".

A learner who signs in or buys on sbf-lotse.de must come back there. The login link has a second reason for this: the session cookie is set for the API host of the page that redeems it.

## Decision

**sbf-lotse.de calls the API on `https://api.sbf-lotse.de`**, the same backend service as api.sks-lotse.de:
- Same-site, so the session cookie stays as ADR-0012 describes it: `__Host-`, httpOnly, `SameSite=Lax`, host-only.
- No `SameSite=None`, no proxy, no single sign-on.
- Each API host has its own cookie, so a learner signs in once on each site.
- **The account is the same**, keyed by the email: token balance, profile, AGB acceptance and deletion are shared.
- **Logout** bumps the account's `token_version` ([ADR-0008](0008-token-version-based-logout.md)), so it ends the sessions on both sites. The cookie it clears is only the one of its own host; the other one is dead anyway.

**CORS allows both sites' origins.**
- `Settings.site_origins` lists them per site. `cors_allowed_origins` is their union, with SKS Lotse's first.
- Production: sks-lotse.de and sbf-lotse.de, each also with `www`.
- Locally: the Vite ports from `.claude/launch.json`. SKS Lotse is on 5173; SBF Lotse is on 5174, 5175 and the preview port 4174.

**The site of a request** comes from `app/core/site.py:resolve_site`, in this order:
1. **The `Origin` header**, if it is on a site's list. The browser sets it on every cross-origin call of the SPA, and a page can't change it.
2. **Otherwise the host**: `api.sbf-lotse.de` means SBF Lotse. This covers a request without `Origin`, such as Postman or curl.
3. **Otherwise SKS Lotse.** That is what every request got before.

What the site decides:
- The brand and sender of the login, email-change and purchase mails. SBF Lotse's sender is `EMAIL_FROM_ADDRESS_SBF`, default `SBF Lotse <noreply@sbf-lotse.de>`, a Resend domain of its own.
- The origin of the login link, the mail footers and the "Weiterlernen" button.
- Stripe's `success_url` and `cancel_url`.
- The wording of the maintenance message.

The site decides nothing about the account, its data or what it may do.

**Stripe**:
- The Checkout Session carries `metadata.site`. The webhook, which Stripe calls without an `Origin`, brands the confirmation mail by it.
- A session without the field, opened before this change, is SKS Lotse's.
- The site is also stored on the purchase (`purchases.site`).

**Two columns for the daily report**, both nullable, added by a migration the running code doesn't notice:
- `users.signup_site`: the site an account was created on.
- `purchases.site`: the site a Stripe purchase was made on.

The report counts new accounts and purchases from SBF Lotse. Both columns are in the admin export. `signup_site` goes with the account on deletion; `purchases.site` is no personal data, so it stays on an anonymized purchase.

Unchanged:
- The admin area stays on sks-lotse.de; the SBF build gets no admin pages. Admin 2FA keeps the issuer "SKS Lotse".
- The rate limit: api.sbf-lotse.de is a custom domain of the same service behind the same Cloudflare edge as api.sks-lotse.de, so `CF-Connecting-IP` carries the learner's IP there too. A first measurement on 2026-10-24, before this ADR's code: once one network's default bucket was full directly on api.sks-lotse.de (the first 429 at request 301), api.sbf-lotse.de answered 429 too, from the same bucket. The update below measures the login's own bucket after the deploy.

## Consequences

- A learner on sbf-lotse.de gets mails, links and Stripe redirects of SBF Lotse; SKS Lotse's are byte for byte what they were (a test compares them).
- A learner who uses both sites signs in twice, once on each. That's the price of a first-party cookie per site without SSO; the account behind it is one.
- **The client IP via api.sbf-lotse.de has to be measured** before accounts on SBF Lotse open, with the method of ADR-0069's update:
  - Fill the bucket of `/api/v1/auth/otp/verify-link` from one network on api.sks-lotse.de.
  - The same request on api.sbf-lotse.de must then get 429, not 401.
  - The result is added here as an update. Accounts on sbf-lotse.de stay switched off in its build until then (increment 2's next PR).
- A second sender domain to keep verified at Resend, and a second custom domain on the backend service ([RUNBOOK](../RUNBOOK.md) → One-time setup SBF, part 2).
- The backend service now has four custom domains: api.sks-lotse.de, api.sbf-lotse.de, sks-lotse.com and its www. Render's dashboard still read "2 / 2 included", so whether the extra one costs is a question of the plan. sks-lotse.com and www only redirect to sks-lotse.de and could move elsewhere, should the slots matter.
- Each API host serves every route. api.sks-lotse.de is meant for sks-lotse.de and api.sbf-lotse.de for sbf-lotse.de, but nothing beyond CORS and the site resolution enforces that. That is fine: the guards don't depend on the host, and a session lives on one host only.
- An `Origin` the backend doesn't know is not refused. It only falls back to the host. CORS keeps a foreign page from reading the answers, and the cookie's `SameSite=Lax` keeps it from riding along on a cross-site call, as before.
- Rejected:
  - **The proxy (ADR-0069):** it hid the learner's IP from the rate limit.
  - **A `SameSite=None` cookie:** blocked as a third-party cookie.
  - **A shared session across both sites (SSO, a cookie on a common parent domain):** the two domains have no common parent, and an SSO flow is a lot of machinery for signing in once more.
  - **A site parameter sent by the frontend:** a header the browser sets itself can't be wrong by mistake.
  - **A backend flag for SBF accounts:** the switch is the SBF build's `VITE_SBF_ACCOUNTS`. Without the login on sbf-lotse.de, nobody gets there.

## Update 2026-10-24: the client IP measured, accounts in the SBF build

**The client IP on api.sbf-lotse.de**, measured from one network after the backend deploy, with ADR-0069's method:
- 30 requests to `POST /api/v1/auth/otp/verify-link` with a dummy token on api.sks-lotse.de filled the bucket (limit 30 an hour per IP).
- The next request there got 429, as expected.
- The same request on api.sbf-lotse.de got **429** too, over IPv4 and over IPv6. Both hosts put this network into the same bucket, so the backend sees the learner's IP on api.sbf-lotse.de.
- A client-sent `True-Client-IP` changed nothing (429).

**The SBF build gets the session**, as ADR-0069's Consequences foresaw:
- The session parts moved from `src/sks/` to `src/shared/`: the API client and the account's types, the auth store, the login form and link page, `ProtectedRoute`, `AgbGate`, the Konto menu, the token counter, the account settings and the token purchase.
  - The auth store no longer knows SKS Lotse's Formblatt. A site registers what it keeps in the browser (`registerBrowserDataCleanup`), and logout and account deletion forget it.
  - Each site names where a learner lands after the login and what a check costs (`SiteIdentity.afterLogin`, `checkPrices`).
- **Behind a build flag, `VITE_SBF_ACCOUNTS`** (off | on, only with `VITE_SBF=on`). "on" adds `/login`, `/login/link`, `/pricing` and `/profile`, the session check on start, and the balance and Konto menu in the header. "off" keeps sbf-lotse.de a guest site that makes no API call. It is no backend flag: without the login on sbf-lotse.de, nobody signs in there.
- **The build's API host** is `VITE_API_BASE_URL=https://api.sbf-lotse.de`, and its CSP allows only that one.
- **`check-sbf-build.mjs`** no longer checks "no API call". It now checks "no SKS page and no SKS data":
  - none of the API routes only SKS Lotse's pages call (`/admin/`, `/exams`, `/chart-exercises`, …)
  - none of its data chunks
  - no `https://api.sks-lotse.de`
- **One AGB text for "SKS Lotse und SBF Lotse"**, a new version every account confirms again. SBF Lotse shows it at `/terms` and links it in its footer. The Datenschutzerklärung names api.sbf-lotse.de, the cookie per site and the site recorded with an account and a purchase.

