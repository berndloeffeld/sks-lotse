# 0041. AGB acceptance tracking and inactivity-based retention reservation

Status: Accepted — amends [ADR-0032](0032-daily-kpi-report.md) (adds `last_login_at`, not used for KPIs).

## Context

With the operator's Gewerbe registered, SKS Lotse gets its first AGB (terms of service). Two things follow from that:

- We need to be able to show, per account, that the user has actually agreed to the AGB currently in force — a version identifier and a timestamp.
- A DSGVO-conscious retention policy needs a way to tell an active account from a stale one, so the AGB can reserve the right to delete an account after a period of inactivity (12 months). That needs a last-login timestamp, which the app has deliberately not had until now: ADR-0032 states "The app keeps no event log and no last-login timestamp" and derives its KPI activity figures purely from learning events instead.

The two are related (both are new personal-data columns on `users` driven by the same AGB change) but serve different purposes, so they're kept separate rather than merged into one "activity" concept.

## Decision

- `users` gets two new columns: `agb_accepted_version`/`agb_accepted_at` (set only by the account holder confirming), and `last_login_at` (set by the server on every successful login).
- **Consent capture is gated, not forced on every login.** A dedicated `POST /auth/me/agb-accept` endpoint (authenticated, no request body — it can only ever confirm the one version the server currently knows, `app/core/legal.py::CURRENT_AGB_VERSION`) stamps both fields. The frontend only asks for this once: `routes/AgbGate.tsx` sits inside `ProtectedRoute` and renders a confirmation screen instead of the requested page whenever the account's stored `agb_accepted_version` doesn't match the current one — true for every existing account right after this ships (a one-time prompt), and true again automatically whenever `CURRENT_AGB_VERSION` is next bumped for a materially changed AGB. Otherwise it's invisible. A checkbox on every login (the first design considered) was rejected as needless friction for the overwhelming majority of logins, where nothing has changed.
- `last_login_at` is set unconditionally in `verify_otp`, indexed (`ix_users_last_login_at`) for the `last_login_at < cutoff` scan a future cleanup job will run. It is **not** reused for the KPI report: ADR-0032's DAU/WAU/MAU/retention figures stay defined purely by learning activity (grading a question, starting an exam), so adding a broader "was logged in" signal doesn't quietly change what "active" means there.
- The actual deletion of inactive accounts (a scheduled job, a reminder email beforehand) is **out of scope here** — this ADR only adds the data point the AGB now reserves the right to act on. It's a separate, later piece of work, expected to follow the `sks-lotse-daily-report` cron pattern (its own `SessionLocal()` session, its own Render Cron Job) and reuse the existing `delete_user_and_progress`.

## Consequences

- Every existing account sees the AGB-Gate exactly once after this release (its `agb_accepted_version` starts `NULL`); this is intended, not a bug — the AGB didn't exist for them before.
- ADR-0032's stated reason for not tracking last-login ("not worth it yet", scoped to KPI activity) is revisited here for a different purpose (retention, not KPIs) — the KPI report itself is unchanged.
- The AGB's 12-month inactivity clause is, for now, a reservation without automated enforcement. Until the follow-up cleanup job exists, no account is actually deleted for inactivity — this is a legal option being held in reserve, not a live behavior, and should not be described elsewhere as already happening.
- Rejected alternative: requiring `agb_accepted_version` on the OTP-verify request itself (checkbox at every login). Simpler to implement (one endpoint, no gate component) but reintroduces friction on every single login indefinitely, for a value that changes rarely.
