# 0034. SSO with Google and Facebook via a server-side authorization-code flow

Status: Accepted

## Context

[ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md) made login mandatory and named SSO (Google, Facebook, X) next to email + OTP, but only OTP was built. A learner without a password manager or with a slow mail provider finds a one-click login a lot easier; SSO was always the intended main path. X is dropped: its API is paid and unstable, and its login doesn't reliably return a verified email — which the account model needs (email is the account key, allowlist and quotas hang off it).

Session handling is settled: an httpOnly cookie, no token in JS ([ADR-0012](0012-httponly-cookie-for-frontend-session-token.md)). Frontend (`sks-lotse.de`) and API (`api.sks-lotse.de`) are same-site.

## Decision

- **Server-side authorization-code flow**, no provider JavaScript SDK in the frontend. `GET /auth/sso/{provider}/start` redirects the browser to the provider; `GET /auth/sso/{provider}/callback` (registered at the provider as redirect URI) trades the code for the provider's user id and email over TLS, sets the *same* session cookie as `verify_otp`, and redirects to `/start`. No provider token is stored or reaches the browser, and nothing new for the CSP (full-page redirects).
- **State and PKCE** live in a short-lived (10 min), httpOnly, `SameSite=Lax` cookie scoped to `/api/v1/auth/sso`, signed with `JWT_SECRET` — no server-side storage. The callback requires it and a matching `state`. PKCE (S256) is used for Google; for Facebook the state cookie is the CSRF protection.
- **No auth library**: the exchange is two HTTPS calls per provider with `httpx` (already a dependency), against Google's userinfo endpoint and Facebook's Graph `/me`. Fewer dependencies to keep patched than `authlib`; the price is that a third provider means a few lines in `services/sso.py`.
- **Accounts**: table `user_identities` (`provider`, `subject`, unique together, `user_id`). Login goes by `(provider, subject)`, so a changed email at the provider doesn't detach the account. A *first* login links to the account with the same canonical email (`canonicalize_email`) or creates one — **only if the provider reports the email as verified** (Google: `email_verified`; Facebook returns only confirmed addresses and omits it otherwise). Without a verified email the learner is sent back to `/login?sso_error=no_email` to use the email code. Linking by unverified email would let anyone take over an account by registering its address at a provider.
- **Same rules as OTP**: `ALLOWED_EMAILS`, the disposable-domain blocklist, per-IP rate limits (the OTP cap on each start/callback path), `token_version`. Errors are redirects to `/login?sso_error=<code>` (`cancelled`, `no_email`, `not_allowed`, `failed`), never a 401 — the frontend treats every 401 as a dead session.
- **Optional per provider**: an empty client id or secret switches a provider off; `GET /auth/sso/providers` tells the login page which buttons to show. Local dev and CI run without any credentials.
- **DSGVO**: `user_identities` is deleted with the account and part of the admin export. The privacy policy names Google and Meta and doubles as the "data deletion instructions" URL Facebook Login requires (deletion is the account deletion in `/profile`); no separate deletion callback is built.
- Facebook is asked for `email` only, Google for `openid email`; the name isn't requested (the profile's name fields stay self-reported).

## Consequences

- Two OAuth apps to keep alive outside the repo (Google Cloud Console, Meta for Developers): consent screens, redirect URIs for production and localhost, the Meta app in Live mode. Their secrets are `sync: false` on Render.
- Whoever controls an email address at a provider can sign in to the account with that address — the same trust model as OTP, where controlling the inbox is enough. It also means an email change at the provider is *not* followed; the identity stays on the old account until that is changed in `/profile`.
- An SSO-only learner has no separate credential: if the provider account is lost, the email code still works for the same address.
- Facebook is the awkward one: learners without an email on their Facebook account, or with only a phone number, get `no_email` and must use the code.
- Amends [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md), which still names X; that ADR isn't rewritten.
