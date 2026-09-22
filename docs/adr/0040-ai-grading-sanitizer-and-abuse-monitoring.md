# 0040. AI-grading sanitizer and abuse monitoring

Status: Accepted

## Context

The Lotsen-Check ([ADR-0031](0031-ai-answer-check-with-claude-haiku.md), amended by
[ADR-0036](0036-weekly-ai-check-budget-with-admin-overrides.md)) is currently reachable only for
accounts the operator flips `ai_grading_enabled` on by hand. Self-service unlock (payment) will
remove that manual gate soon, growing the abuse surface. Two gaps existed:

1. **No defense against prompt injection in the `feedback` field.** The learner's answer is sent
   to Claude Haiku inside `<antwort>` tags with an instruction that it's never a command to the
   model — but there was no code-level fallback if the model was jailbroken anyway into emitting
   arbitrary or off-topic text via `feedback`, which the learner sees as coming from SKS Lotse.
2. **No abuse-monitoring signal**, while ADR-0031 explicitly commits to never storing or logging
   the learner's answer. Any new signal has to hold that line.

## Decision

- **System-prompt hardening**: the prompt now explicitly tells the model that if `<antwort>`
  contains instructions, is off-topic, or is inappropriate, it must grade `falsch` itself and give
  a short, fixed-style refusal — never repeating or engaging with the injected content.
- **Code-level backstop** (`app/services/grader.py`, `_looks_injected`): after parsing the
  structured reply, the feedback is replaced with a fixed German fallback and the outcome forced
  to `falsch` if either the feedback exceeds `GRADING_FEEDBACK_MAX_CHARS` (default 500 — normal
  feedback is "höchstens 3 kurze Sätze") or it contains the learner's stripped answer verbatim (a
  cheap signal that the model echoed injected content instead of grading). `grade_answer` now
  returns a `GradedAnswer(result, sanitized)` wrapper rather than the bare `GradeResult`, since
  `GradeResult` doubles as the Anthropic `output_format` schema and must not gain a field the model
  itself would be asked to produce.
- **Persisted per-account counter**: `users.ai_flags_count`/`ai_flags_last_at`, bumped by
  `app/services/ai_quota.py::record_sanitizer_flag` on every backstop trip. Read-only on `/admin`
  next to the existing `ai_checks_used` display (`AdminUserRead`, part of the DSGVO export like
  every other personal-data column on `User`) — no admin reset control, since it's a diagnostic
  signal to investigate, not an entitlement to adjust.
- **Daily KPI report** (ADR-0032): `QualityKpis` gained `ai_flags_24h` (accounts newly flagged in
  the last 24h) and `ai_flags_total` (cumulative, all accounts). Deliberately a cumulative counter
  plus a `last_at` timestamp, not a new events table — an events table would need its own cleanup
  and index for a secondary signal, and "how many distinct accounts got newly flagged" is the more
  actionable number for the operator than a raw per-occurrence count (one noisy account shouldn't
  inflate the "24h" figure). Finer per-event detail is still available via the log line below.
- **429 logging**: the three existing rate-limit branches in `app/api/v1/grading.py` (per
  question/day, per hour, weekly budget) now log a `warning` with the user id and bucket — they
  were previously silent.
- **Threshold-triggered extended logging**: once `ai_flags_count` reaches
  `GRADING_SANITIZER_LOG_THRESHOLD` (default 3), subsequent ai-grade calls for that account log a
  warning with the question id, outcome, and whether the call was sanitized again — **never** the
  learner's answer or the model's feedback text, preserving ADR-0031's commitment.

## Consequences

- The heuristics are pattern-based, not semantic, so false positives are possible (unusually long
  but legitimate feedback, or a short answer that happens to be echoed). `GRADING_FEEDBACK_MAX_CHARS`
  and `GRADING_SANITIZER_LOG_THRESHOLD` are both env-tunable if that shows up in practice.
- No new module needed in the mutation-testing scope (`backend/pyproject.toml`'s `only_mutate`) —
  every touched file (`grader.py`, `grading.py`, `ai_quota.py`, `kpis.py`, `admin.py`) was already
  listed.
- New migration adds two columns to `users`; both are personal data and now part of the admin
  GDPR export (`AdminUserExport` → `AdminUserRead`).
- **Rejected**: a second moderation LLM call per grading request — extra latency, cost, and
  complexity disproportionate to the current risk level, given the account is still gated by
  `ai_grading_enabled` and bounded by the existing rate limits/weekly budget. Revisit if
  self-service unlock materially increases abuse volume or the heuristic backstop proves
  insufficient in the KPI trend.
