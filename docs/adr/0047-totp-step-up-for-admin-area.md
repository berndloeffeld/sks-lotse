# 0047. TOTP step-up for the admin area

Status: Accepted — amends [ADR-0019](0019-admin-allowlist-and-manual-gdpr-fulfillment.md): an allowlisted admin also needs a recent TOTP check for `/admin`

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
