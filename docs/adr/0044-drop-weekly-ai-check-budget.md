# 0044. Drop the weekly AI-check budget — tokens are the sole spending control

Status: Accepted — supersedes [ADR-0036](0036-weekly-ai-check-budget-with-admin-overrides.md); reverses the "keep the weekly budget" decision of [ADR-0043](0043-token-based-ai-grading-monetization.md); drops the budget [ADR-0040](0040-ai-grading-sanitizer-and-abuse-monitoring.md) amended alongside it.

## Context

[ADR-0043](0043-token-based-ai-grading-monetization.md) introduced a pay-per-use token balance for the Lotsen-Check and deliberately kept the older weekly quota ([ADR-0036](0036-weekly-ai-check-budget-with-admin-overrides.md): `users.ai_checks_used`/`ai_checks_week`/`ai_checks_weekly_limit`, an app-wide default in `app_settings` via `/admin/settings`) alongside it, as a second abuse brake.

In practice this doubled every place that touches account limits — the grading endpoint reserved/refunded two independent counters per check, the admin user page showed two overlapping controls ("Tokens" and "KI-Prüfungen diese Woche" with its own "Standard"/override toggle), and `/auth/me`/the Lotsen-Check hint carried both a token count and a "noch N diese Woche" figure. Since the token balance already caps total spend (a check literally costs money now, unlike when the weekly quota was introduced to bound free, unmetered usage), the second brake no longer earns its complexity — it mainly confused the admin UI without meaningfully reducing abuse beyond what the token balance and the existing per-question/per-hour rate limits already do.

## Decision

- **The token balance is the only spending control for the Lotsen-Check.** The weekly quota (`ai_quota.py`, `users.ai_checks_used`/`ai_checks_week`/`ai_checks_weekly_limit`, the `ai_checks_weekly_default` `app_settings` key, `/admin/settings`'s weekly-default field, the per-user override on `/admin`) is removed entirely.
- The per-question-per-day and per-hour in-memory rate limits (abuse guards, not a budget) are unaffected — they still apply on top of the token check.
- `app/services/ai_quota.py`'s sanitizer-flag counter (ADR-0040, unrelated to the budget it happened to share a file with) is kept, moved to `app/services/ai_abuse_monitoring.py`.
- `AiGradeRead.remaining_this_week` and `UserRead.ai_checks_remaining` are removed from the API; only `tokens_remaining` is reported after a check.

## Consequences

- Simpler mental model and UI: one number (tokens) instead of two independent counters that could disagree about whether a check is possible.
- An account with an empty token balance stays blocked until an admin grants more (or a future purchase flow exists) — there is no automatic Monday reset to fall back on anymore. This is the intended trade: tokens are meant to run out and be topped up, not regenerate for free.
- Schema/endpoint changes: drops `users.ai_checks_week`/`ai_checks_used`/`ai_checks_weekly_limit` and the `User.ai_checks_limit`/`ai_checks_remaining` properties (migration `deb5a1d76210`); `GRADING_MAX_PER_WEEK` env var and `Settings.grading_max_per_week` are removed; `AdminUserRead`/`AdminUserUpdate`/`AdminSettingsRead`/`AdminSettingsUpdate` lose their weekly-budget fields.
- The `app_settings` table stays (ADR-0043's prices live there too) — only the `ai_checks_weekly_default` key stops being read/written; any pre-existing row with that key becomes an inert orphan, not worth a migration to clean up.
- Rejected: keeping the weekly quota as a "just in case" secondary cap. If a real abuse pattern shows up that tokens and the existing rate limits don't catch, address it with a guard scoped to that pattern rather than reintroducing a second, independent budget.
