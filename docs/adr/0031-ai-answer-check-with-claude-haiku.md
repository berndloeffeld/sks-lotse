# 0031. AI answer check with Claude Haiku

Status: Accepted

## Context

Learners without AI grading self-assess against the official answer ([ADR-0023](0023-self-assessed-learning-flow.md)). The unlockable add-on ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) is an LLM that checks the written answer. ADR-0003/0006/0023 assumed OpenAI; the project already uses the Anthropic API (Haiku) for catalog classification, so one provider and one key are simpler. Payment does not exist yet.

## Decision

- `POST /api/v1/questions/{id}/ai-grade` (`app/api/v1/grading.py`, `app/services/grader.py`): one synchronous, stateless call to `claude-haiku-4-5` (`ANTHROPIC_GRADING_MODEL`) per click. It returns a *suggested* outcome (same three values as the self-assessment) plus 2–3 sentences of feedback. It saves nothing; the learner confirms via the existing `POST /progress/questions/{id}`, so streak logic stays in one place.
- **Minimal context, no history**: the prompt contains only the question, the official answer (both read from the DB by id, never trusted from the client) and the learner's answer (≤ 1000 chars, wrapped in `<antwort>` tags and declared to be data, not instructions). No subject, topic, variant, account data or earlier attempts. That is ~400 input tokens; output is capped at 300 tokens, `temperature=0`, no extended thinking, structured output with `outcome` before `feedback`. Prompt caching is skipped: the prefix is far below Haiku's cache minimum.
- The learner's answer is neither stored nor logged.
- Entitlement is a boolean `users.ai_grading_enabled` (default false, exposed on `UserRead`), set by hand until payment exists. Others get a disabled "bald verfügbar" teaser and no backend call. The endpoint answers 403 regardless.
- Guards: 403 (not unlocked) → 422 (blank/too long) → 404 → 409 (the 2 questions whose official answer is only a sketch) → per-user hourly cap (429, `check_and_record`) → 503 if the key is missing or the API fails/times out (15 s, one retry). Self-assessment keeps working in every failure case.

## Consequences

- `anthropic` moves from `requirements-dev.txt` to `requirements.txt`; `ANTHROPIC_GRADING_API_KEY` is a production secret (`render.yaml`, `sync: false`). It is deliberately a different variable, and a different Console key/workspace, from `ANTHROPIC_API_KEY` (local catalog tooling), so each has its own spend limit and can be rotated independently.
- The learner's answer leaves for a US processor: the Datenschutzerklärung must name Anthropic (with AVV/SCC) before the unlock is offered to real users.
- Questions that refer to charts can only be judged against the answer text, since images aren't extracted yet.
- Rejected: sending subject/topic/history (cost, privacy, little gain); auto-saving the LLM's grade (a wrong verdict would silently move a streak); streaming (short answers, not worth the complexity).
- Payment, and thus who gets the flag, is still open.
