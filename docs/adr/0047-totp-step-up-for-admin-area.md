# 0047. TOTP step-up for the admin area

Status: Accepted — amends [ADR-0019](0019-admin-allowlist-and-manual-gdpr-fulfillment.md): an allowlisted admin also needs a recent TOTP check for `/admin`; the addendum of 2026-10-01 shortens the check to 60 min and asks again before an export or deletion

## Context

The admin area (ADR-0019) exports, deletes and blocks accounts and grants tokens. Until now its only gate was the email allowlist plus the email login code. Whoever could read the admin's inbox was admin for the seven-day session. The login itself should stay unchanged for learners and for the admin as a learner. Only the admin area needs the stronger factor.

Options considered:

- **TOTP on every admin login.** No session at all without the code. That is stricter, but the admin then also needs the phone just to learn, and the login flow forks by address.
- **WebAuthn / passkeys.** Phishing-resistant, but a lot more code (registration ceremony, credential storage, browser support) for a single-operator app.
- **TOTP as a step-up when entering `/admin`.** Standard authenticator apps (Authy, Google Authenticator), no new infrastructure, and the learner flow is untouched.

## Decision

TOTP (RFC 6238, 6 digits, 30 s) as a step-up for the admin area:

- **Enrolment in the app.**
  - The first visit to `/admin` offers the setup: `POST /admin/mfa/enrol` returns the secret as QR code and text. The first accepted code switches 2FA on (`POST /admin/mfa/verify`).
  - A pending secret can be replaced by enrolling again. An active one can't: otherwise a stolen email session could enrol its own authenticator.
- **Freshness claim.**
  - A successful check re-issues the session token with an extra `mfa` claim: the unix time of the check.
  - `require_admin` (`app/core/jwt.py`) demands `mfa` no older than `ADMIN_MFA_MAX_AGE_MINUTES` (12 h). Without it the answer is 403 `mfa_required`, and the frontend then asks for a code.
  - Not 401, because the frontend logs out on any 401.
  - The session itself keeps its seven days, and logout (`token_version`) ends the claim along with the token.
- **Storage.**
  - Three nullable columns on `users`: `totp_secret_encrypted`, `totp_enabled_at` and `totp_last_counter`.
  - The secret is Fernet-encrypted with a key derived from `JWT_SECRET` via HMAC, the same pattern as the OTP hash key (`app/core/otp.py`).
  - The last accepted time step is stored so a code can't be replayed.
- **Limits.** Per admin, 5 attempts per 15 minutes. Per IP, the OTP-verify rule.
- **Recovery.**
  - `backend/scripts/reset_admin_totp.py` clears the three columns and bumps `token_version`.
  - The GitHub Action "Reset admin 2FA" (`.github/workflows/reset-admin-2fa.yml`) starts it as a Render one-off job, so no Render dashboard or shell is needed.
  - No recovery codes.

## Consequences

- **Stolen inbox.** Access to the admin's inbox alone no longer opens the admin area. The attacker also needs the phone, or push access to the repo (which could deploy any code anyway).
- **Bootstrap gap.** Until the admin has enrolled, whoever logs in first as that admin can enrol. So an admin enrols right after being added to `ADMIN_EMAILS`. The admin export shows `totp_enabled_at`.
- **`JWT_SECRET` rotation.** Rotating it makes the stored secrets unreadable. Every admin then needs a reset and a new enrolment (docs/RUNBOOK.md). A separate encryption key would avoid this, but it would be one more secret to manage for a rare event.
- **No recovery codes.** That means less code and less personal data. Recovery depends on GitHub access (or the Render shell) instead, which fits a single operator.
- **Integration tests.** The integration collection computes TOTP codes itself (CryptoJS in the pre-request script), so the admin folder still runs end to end against a real server.

## Addendum (2026-10-01): shorter check, a fresh code for export and deletion

ADR-0027's addendum of 2026-09-23 keeps the AdSense script out of every document under `/admin`. But the session cookie isn't scoped to `/admin`: it is origin-wide on the API, and an admin's session carries its `mfa` claim everywhere. The four prerendered public pages carry the ad tag, CORS accepts `sks-lotse.de` with credentials, and the claim lasted 12 h. So for 12 h after one code, any script on a public page the admin opened (via the footer's "Cookies" button on `/admin`, say, which led to `/privacy`) could call the admin API with that session.

Changes:

- **`ADMIN_MFA_MAX_AGE_MINUTES` drops from 720 to 60.** The window in which the claim is worth stealing shrinks to an hour. For a single operator who opens `/admin` for a task and leaves, it costs one more code now and then.
- **`require_recent_mfa`** (`app/core/jwt.py`) guards exporting (`GET /admin/users/{id}/export`) and deleting (`DELETE /admin/users/{id}`) an account. These are the two actions that leak a learner's data in bulk or can't be undone. They need a check at most `ADMIN_RECENT_MFA_MAX_AGE_MINUTES` (5) old, else 403 `recent_mfa_required`. The client's MFA handler (`frontend/src/api/client.ts`) passes that detail on, and `AdminLayout` shows the code field above the page instead of replacing it. An open delete confirmation stays as it was, and the admin repeats the action. A script holding the session can still read lists and single accounts, but it can't pull exports or delete without a code it doesn't have.
- **The "Cookies" footer button is hidden under `/admin`** (`LegalFooter`). There's no ad script there for it to open, and its fallback led to `/privacy`, a page that has one.

Residual risk: within the hour, a script on a public page that the admin opens in the same browser can still read admin data (account lists, single accounts, question history) and change settings, tokens and blocks. Opening public pages from the admin's browser profile while `/admin` is open is the remaining exposure.

The structural fix, deferred: **a separate admin origin** (e.g. `admin.sks-lotse.de` for the admin frontend and its own API host or cookie). The ad-carrying origin would then never hold or send an admin session. It needs a second static site, its own CORS entry and its own cookie, which is more than this single-operator app needs today. Revisit when there is a second admin, or if the ad stack grows beyond the public pages.
