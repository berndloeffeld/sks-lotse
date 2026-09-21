# 0036. Weekly AI-check budget with admin-tunable default and per-user override

Status: Accepted

Amends the budget bullet of [ADR-0031](0031-ai-answer-check-with-claude-haiku.md) (that ADR's other decisions stand).

## Context

ADR-0031 capped the AI answer check at 20 per account and calendar day, one value from an env var (`GRADING_MAX_PER_DAY`) for everyone. Changing it meant a redeploy, and the operator could not give a single account more or fewer checks. A day is also a poor unit: learners study in bursts, so a weekly allowance matches the behaviour better.

## Decision

- **Per week, Monday start.** The counter (`users.ai_checks_used`) counts on the week identified by its Monday (`users.ai_checks_week`, was `ai_checks_day`), in Europe/Berlin (`app/core/ai_quota.py:current_week`). In any other week the budget is full again. The migration renames the column; old values are days, never equal to a current Monday, so every counter starts fresh.
- **Three-level limit**, resolved per request (`ai_quota.effective_limit`): the account's override `users.ai_checks_weekly_limit` (nullable; `0` blocks the check), else the operator's default in the new `app_settings` key/value table (`ai_checks_weekly_default`), else `GRADING_MAX_PER_WEEK` (100, env fallback; replaces `GRADING_MAX_PER_DAY`).
- **Operator UI:** the per-user override sits on `/admin` (`PATCH /admin/users/{id}` with `ai_checks_weekly_limit`; explicit `null` resets to the default), the default on the new `/admin/settings` page (`GET`/`PUT /admin/settings`). Values are bounded 0–10 000.
- The default is read from the database on each use (one primary-key lookup), not cached: the value is edited rarely, but a cache would be stale across instances the moment there is more than one.
- The per-question cap (2 per day) and the hourly cap (30) are abuse guards, not the budget, and stay as they were. The response field `remaining_today` became `remaining_this_week`.

## Consequences

- Cost ceiling per account is ~13 cent per week at the default (100 x ~0.13 cent), and the operator can tighten or loosen it without a deploy.
- `app_settings` is generic, so further operator-tunable values can reuse it; each new key needs its own admin endpoint/validation.
- `ai_checks_weekly_limit` is personal data of the account (it is stored on it), so it is part of `AdminUserRead` and hence the DSGVO export.
