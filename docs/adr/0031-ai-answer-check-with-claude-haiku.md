# 0031. AI answer check with Claude Haiku

Status: Accepted — amended by [ADR-0040](0040-ai-grading-sanitizer-and-abuse-monitoring.md) (sanitizer, abuse monitoring); the boolean entitlement is superseded by [ADR-0043](0043-token-based-ai-grading-monetization.md) (tokens); the budget, amended by [ADR-0036](0036-weekly-ai-check-budget-with-admin-overrides.md), is dropped by [ADR-0044](0044-drop-weekly-ai-check-budget.md). Amended by [ADR-0058](0058-lotsen-check-for-chart-exercises.md): the Kartenaufgaben have their own check, on Sonnet.

## Context

Learners without AI grading self-assess against the official answer ([ADR-0023](0023-self-assessed-learning-flow.md)). The unlockable add-on ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) is an LLM that checks the written answer. ADR-0003/0006/0023 assumed OpenAI; the project already uses the Anthropic API (Haiku) for catalog classification, so one provider and one key are simpler. Payment does not exist yet.

## Decision

- `POST /api/v1/questions/{id}/ai-grade` (`app/api/v1/grading.py`, `app/services/grader.py`): one synchronous, stateless call to `claude-haiku-4-5` (`ANTHROPIC_GRADING_MODEL`) per click. It returns a *suggested* outcome (same three values as the self-assessment) plus 2–3 sentences of feedback. It saves nothing; the learner confirms via the existing `POST /progress/questions/{id}`, so streak logic stays in one place.
- **Minimal context, no history**: the prompt contains only the question, the official answer (both read from the DB by id, never trusted from the client) and the learner's answer (≤ 1000 chars, wrapped in `<antwort>` tags and declared to be data, not instructions). No subject, topic, variant, account data or earlier attempts. That is ~800 input tokens (measured, incl. the system prompt and the response schema); output is capped at 300 tokens, no extended thinking, structured output with `outcome` before `feedback`. Prompt caching is skipped: the prefix is far below Haiku's cache minimum.
- The learner's answer is neither stored nor logged.
- Entitlement is a boolean `users.ai_grading_enabled` (default false, exposed on `UserRead`), set by the operator on `/admin` (`PATCH /admin/users/{id}`) until payment exists. Others get a disabled "bald verfügbar" teaser and no backend call. The endpoint answers 403 regardless. *(Superseded by [ADR-0043](0043-token-based-ai-grading-monetization.md): a pay-per-use token balance replaces the boolean flag.)*
- Guards: 403 (not unlocked) → 422 (blank/too long) → 404 → 409 (the 2 questions whose official answer is only a sketch) → 429 per question and day (2, in memory) → 429 per hour (30, in memory) → 429 daily budget → 503 if the key is missing or the API fails/times out (15 s, one retry; the reserved check is refunded). Self-assessment keeps working in every failure case.
- **Budget:** 20 checks per account and calendar day (Europe/Berlin), persisted on the user (`ai_checks_day`, `ai_checks_used`, reserved under a row lock, refunded on failure) so a deploy can't reset it. Measured cost is ~0.13 cent per check (Haiku 4.5, ~800 in / ~95 out tokens), so the cap bounds one account to ~2.5 cent per day. The remaining count is part of `/auth/me` and of every check's response.
- **UI:** not a big button in front of the grade radios but a fourth row under them, "Antwort vom Lotsen bewerten lassen" with a "KI" corner ribbon and the remaining budget. The check is what you do when you can't decide; a learner who is sure just grades and moves on. It is part of the Tab loop, and Enter on the preselected suggestion saves it.

## Consequences

- `anthropic` moves from `requirements-dev.txt` to `requirements.txt`; `ANTHROPIC_GRADING_API_KEY` is a production secret (`render.yaml`, `sync: false`). It is deliberately a different variable, and a different Console key/workspace, from `ANTHROPIC_API_KEY` (local catalog tooling), so each has its own spend limit and can be rotated independently.
- The learner's answer leaves for a US processor: the Datenschutzerklärung must name Anthropic (with AVV/SCC) before the unlock is offered to real users.
- Questions that refer to charts can only be judged against the answer text, since images aren't extracted yet.
- Rejected: sending subject/topic/history (cost, privacy, little gain); auto-saving the LLM's grade (a wrong verdict would silently move a streak); streaming (short answers, not worth the complexity).
- Payment, and thus who gets the flag, is still open.

## Addendum (2026-09-23): data processing agreement

Anthropic's data processing agreement (as of 2026-09-20) is kept in the repo: [docs/anthropic-dpa-2026-09-20.pdf](../anthropic-dpa-2026-09-20.pdf). The Datenschutzerklärung lists Anthropic as a processor for the Lotsen-Check.

## Addendum (2026-10-04): checklist for partly right and wrong answers

The reply gains two lists, `richtig_genannt` and `fehlt` (at most 4 entries of ~12 words each, from the model answer only), filled only for `teilweise_richtig` and `falsch`; the feedback shrinks to an overall impression of at most 2 sentences. The UI shows them as a checklist. Both fields are additive and default to empty, so the frontend and backend can deploy in either order. `max_tokens` rises from 300 to 500, and the sanitizer (ADR-0040) also rejects a checklist with too many or too long entries or one that echoes the learner's answer. Cost: output grows from ~95 to ~200–250 tokens for a non-right answer, so roughly 0.18–0.21 cent for those and ~0.17 cent on average (was ~0.13), the input is unchanged.

The checklist fields of `GradeResult` have no default: a field with a default is optional in the JSON schema handed to the model, and Haiku then left both lists out (seen in production right after the rollout). The API response (`AiGradeRead`) keeps its empty defaults.

## Addendum (2026-10-08): the send notice stays out of sight

"KI-Prüfung: Deine Antwort wird dafür an Anthropic gesendet." lives only in the tooltip and in the accessible description (`aria-describedby`) of the Lotsen-Check button (`LotseCheckButton.tsx`), not in a visible caption. This was decided when the button was built and recorded only in a code comment; it is recorded here. Reasons: the button is a single compact row that the learner triggers on purpose, the processing is named in the Datenschutzerklärung and the FAQ, and a permanent caption under every check would crowd the self-assessment on small screens. The cost: touch devices have no tooltip, so there the notice is only available to screen readers and in the privacy policy. That was weighed and accepted; revisit it if the notice proves to be missed.
