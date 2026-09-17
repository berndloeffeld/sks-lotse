# 0012. httpOnly cookie for the frontend's session token, not localStorage

Status: Accepted

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
