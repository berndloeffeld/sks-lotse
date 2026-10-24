# 0012. httpOnly cookie for the frontend's session token, not localStorage

Status: Accepted; the addendum of 2026-10-01 names the cookie `__Host-access_token` when deployed; the addendum of 2026-10-14 puts the token in a login response's body only on request; amended by [ADR-0070](0070-sbf-api-host-and-site-per-request.md): one cookie per API host, api.sks-lotse.de and api.sbf-lotse.de, so a learner signs in on each site once

## Context

The backend issues a JWT on `POST /api/v1/auth/otp/verify` and expects it back as `Authorization: Bearer ...` (`backend/app/core/jwt.py`). That token is long-lived (`JWT_ACCESS_TOKEN_EXPIRES_MINUTES`, 7 days by default) with no refresh-token flow — re-authenticating means requesting a new OTP (see [ADR-0008](0008-token-version-based-logout.md)). No frontend exists yet (`docs/ARCHITECTURE.md` → "Not yet built"), but how it stores that token is worth deciding now: it's coupled to how `get_current_user` reads the token, to the CORS config, and to the eventual frontend deployment topology — exactly the kind of decision `CLAUDE.md` calls out as ADR-worthy (costly to reverse, non-obvious to a future reader), and auth flow is named there as an example.

Options considered for *where the token lives in the browser*:
1. **`localStorage`, sent as `Authorization: Bearer ...`** — the conventional choice for a JWT-based SPA, and what the current Bearer-only backend already supports with no changes.
2. **An httpOnly, `Secure`, `SameSite=Lax` cookie**, read server-side instead of (or in addition to) the `Authorization` header.
3. **In-memory only (no persistence) + a short-lived access token refreshed via an httpOnly refresh cookie** — the most XSS-resistant option, but requires a refresh-token flow (new endpoint, refresh-token storage/rotation) that doesn't exist at all yet.

The risk being weighed is XSS: any injected/compromised script in the frontend can read `localStorage`, but not an httpOnly cookie. That risk is more than theoretical here because every account is real (mandatory login, [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) and may hold paid entitlements, and because the token's 7-day lifetime with no revocation-on-suspicion mechanism beyond manual logout ([ADR-0008](0008-token-version-based-logout.md)) means a stolen token stays useful for a long window.

The classic argument against cookies — CSRF — is weaker for this project than usual: the API is JSON-only (no endpoint takes cookie-authenticated form-encoded state changes), and `SameSite=Lax` already withholds the cookie from cross-site `fetch`/XHR requests (it only rides along on a top-level GET navigation), which is enough for a fetch-based SPA without a separate CSRF token.

This decision assumes the frontend will be served same-site with the API (`sks-lotse.de` itself or a subdomain of it) — not yet finalized, since no frontend deployment exists. Same-site keeps the cookie config simple (`SameSite=Lax` and default cookie scoping); a cross-site frontend would need `SameSite=None` (CSRF protection becomes more load-bearing) and is more exposed to browsers' anti-tracking cookie restrictions. If that assumption changes when the frontend's deployment is actually decided, revisit this ADR rather than silently reinterpreting it.

## Decision

The session token will be stored as an **httpOnly, `Secure`, `SameSite=Lax` cookie**, not in `localStorage` (option 2). Option 3 (in-memory + refresh cookie) is rejected for now — it's the better long-term shape, but adds a refresh-token flow this project doesn't otherwise need yet; revisit if/when one gets built for other reasons (e.g. shorter-lived access tokens become a requirement).

When the frontend work starts, this implies backend changes not yet made:
- `POST /auth/otp/verify` sets the cookie (`Set-Cookie`, `HttpOnly; Secure; SameSite=Lax; Path=/`) in addition to (or instead of) returning `access_token` in the JSON body.
- `get_current_user` (`backend/app/core/jwt.py`) reads the token from the cookie first, falling back to `Authorization: Bearer` — kept for Postman (`postman/`), the integration-test suite, and any future non-browser client.
- `POST /auth/logout` clears the cookie in addition to incrementing `token_version`.
- CORS (`backend/app/main.py`) adds `allow_credentials=True`; the existing explicit origin allowlist (`Settings.cors_allowed_origins`, never `*`) is a prerequisite for that to work at all — `Access-Control-Allow-Credentials` is rejected by browsers when paired with a wildcard origin.

## Consequences

- The frontend never touches the token directly — no risk of a compromised dependency or an XSS payload reading it out of `localStorage`.
- The backend gains a second way to receive the token (cookie vs. header) instead of a single mechanism — a small, permanent bit of extra surface in `get_current_user`, justified by keeping Bearer-token clients (Postman, the integration-test suite, a possible future mobile app) working unchanged.
- No CSRF token is introduced. If a future endpoint ever needs to accept cross-site, cookie-authenticated form submissions (not the case for anything currently planned), that assumption would need revisiting.
- Ties the frontend's deployment to being same-site with the API for the simple `SameSite=Lax` config assumed here. If the frontend ends up on an unrelated origin, this ADR's cookie attributes (`SameSite=None`, revisit CSRF) need updating — not a reason to avoid deciding now, since the alternative (`localStorage`) has the larger, harder-to-bound downside (XSS) regardless of topology.
- Still doesn't address the underlying 7-day-no-refresh token lifetime ([ADR-0008](0008-token-version-based-logout.md)) — an httpOnly cookie stops the token from being *read* by a script, but a still-valid stolen session (e.g. via a physically compromised device, or a proxy that can see `Set-Cookie`) is out of scope here, same as it already is for ADR-0008.

## Addendum (2026-10-01): `__Host-` cookie name when deployed

The cookie was set host-only on `api.sks-lotse.de`, but nothing stopped a page on the parent domain from setting a second `access_token` with `Domain=sks-lotse.de`. Browsers send both, and Starlette keeps the last one of a name. So whatever runs on `sks-lotse.de` (including the ad script on the public pages, ADR-0027) could plant its own session and log the visitor into an attacker's account (cookie tossing / login CSRF), or shadow the real one.

When deployed (`settings.is_production`) the cookie is now called `__Host-access_token`. Browsers only accept a cookie with that prefix when it is `Secure`, has `Path=/` and has no `Domain`, so no other host can set one for the API. `get_session_claims` reads only that name, never a bare `access_token` as a fallback, which would reopen the hole. Local dev runs on plain `http://`, where a `__Host-` cookie is never stored, so it keeps the bare name. One helper in `app/core/jwt.py` (`session_cookie_name()`, plus `clear_session()` for logout and account deletion) decides it. Clearing repeats `Secure`, because browsers ignore a `__Host-` `Set-Cookie` without it, deletions included.

Consequence: on the deploy that ships it, every browser session ends once (the old cookie is no longer read), and learners log in again. The old cookie stays in the browser, unread, until it expires. The Bearer fallback is unaffected.

## Addendum (2026-10-14): the token in the body only on request

The login responses (`POST /auth/otp/verify`, `POST /admin/mfa/verify`) carried the session token in the JSON body as well, "for Postman and future non-browser clients". The frontend never read it, but a compromised third-party script (Umami runs on `/login` and the landing page, ADR-0016) or an XSS could wrap `fetch` and read the 7-day token from the response, and `get_session_claims` accepts it as a Bearer from anywhere until logout. That undid the point of the httpOnly cookie.

Now `access_token` in the body is `null` unless the request carries `X-Token-In-Body: true` (`wants_token_in_body`, `token_body` in `app/core/jwt.py`; `TokenRead.access_token` is optional). The cookie is set either way. The header is deliberately not in the CORS `allow_headers` (`app/main.py`): frontend and API are on different origins (ADR-0015), so a script in a browser fails the preflight when it sends the header, and cannot switch the token into the body of the page's own login. `test_the_opt_in_header_is_not_allowed_cross_origin` pins that. Postman, `scripts/run_integration_tests.sh` and any script send the header; the generated collection lists it as a header of both endpoints (value `false`, set it to `true`).

Consequences: a non-browser client that read the token from the body without the header gets `null` and must send it (or read the `Set-Cookie` header, which the integration collection does for two of its logins to cover the default path). A browser extension or a script on an allowed origin that sets the header is out of scope, as before: the CORS allow-list is the boundary.

## Addendum 2026-10-20: `token_body` gone

`app/core/jwt.py` no longer builds the login response: `token_body` is gone, so `core` imports nothing from `app/schemas`. The two routes that issue a session (`POST /auth/otp/verify`, `POST /admin/mfa/verify`) build `TokenRead(access_token=... if token_in_body else None)` themselves; the behaviour is as described above.
