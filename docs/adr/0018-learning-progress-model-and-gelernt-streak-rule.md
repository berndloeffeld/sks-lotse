# 0018. Learning-progress data model and the "gelernt" streak rule

Status: Accepted; the "gelernt" streak rule (and `correct_streak`) is superseded by [ADR-0034](0034-half-life-model-for-gelernt.md). The table layout, the tip rule (restated as its own decision in [ADR-0038](0038-tip-reveal-caps-grading-outcome.md)) and the summary endpoint stand.

## Context

[ADR-0014](0014-visual-design-system.md) flagged two product rules that shape the Lot-gauge/grading UI but couldn't be formalized yet because "they affect a questions/progress data model that doesn't exist yet":

1. A question counts as **"gelernt"** only after 3 **consecutive** "Richtig" gradings — a "Teilweise Richtig" or "Falsch" grading resets that question's streak to 0. It is not a cumulative correct-answer count.
2. Revealing a question's optional tip disables "Richtig" as a possible outcome for that attempt, capping it at "Teilweise Richtig" — this prevents gaming rule 1 by peeking at a hint before answering.

ADR-0014 said both "need an ADR of their own once the grading/progress backend work actually starts." That work is starting now — not with the grading endpoint itself (still not built; see "Not yet built" in [ARCHITECTURE.md](../ARCHITECTURE.md)), but with the data model underneath it and a read-only "Lernstand" (learning status) overview on a new `/learn` page, so the "Lernen" tile on `/start` stops being an inert placeholder.

## Decision

- New table `question_progress`, one row per `(user, question)`, with a single `correct_streak` integer column (default 0) — not a cumulative counter, not a separate "learned" boolean. "Gelernt" is computed as `correct_streak >= 3` (`app/core/progress.py`'s `LEARNED_STREAK_THRESHOLD`/`is_learned()`), so the threshold has one source of truth shared by every future caller (the summary endpoint today, a grading endpoint later) instead of risking a stored boolean drifting out of sync with the streak that produced it.
- Both FKs (`user_id`, `question_id`) are `ON DELETE CASCADE` — a progress row is meaningless without its user or its question, unlike `Question.topic_id`'s `SET NULL` (an optional classification, not the row's identity).
- `UniqueConstraint(user_id, question_id)` doubles as the table's only index: it directly serves the future write path ("does a row for this user+question exist, to update its streak") and, with `user_id` as the constraint's leading column, this decision's read path too ("aggregate this user's learned count per topic").
- A new `GET /api/v1/progress/summary` endpoint returns, per topic (scoped to the caller's `exam_variant` the same way `GET /questions` already is), a total question count and a learned-question count. Nothing writes to `question_progress` yet, so every count reads as genuine zeros today rather than a hardcoded UI placeholder — the same endpoint keeps working, unchanged, once grading starts writing real streaks.
- Rule 2 (tip reveal caps grading at "Teilweise Richtig") is recorded here as the rule a future grading endpoint must enforce. **No code enforces it yet** — there is no grading endpoint to enforce it in. This ADR exists now because the `question_progress` design above assumes rule 2 holds (a streak-incrementing "Richtig" is never tip-assisted); it does not itself implement rule 2.

## Consequences

- The "Lernen" tile on `/start` can become a real link to `/learn`, showing a genuine (if currently all-zero) Lernstand per topic, without waiting for the LLM grading feature.
- The eventual grading endpoint has a clear, narrow contract to fill in: on "Richtig" (tip not revealed) increment `correct_streak`; on "Teilweise Richtig", "Falsch", or a tip-assisted "Richtig", reset it to 0. It should import `LEARNED_STREAK_THRESHOLD`/`is_learned()` from `app/core/progress.py` rather than re-deriving the threshold.
- Rejected: a stored `learned: bool` column alongside `correct_streak`. Computing it from the streak removes an entire class of bug (the two fields disagreeing) at negligible query cost.
- Rejected: building the grading endpoint and this data model in the same change. Splitting them let the "Lernen" tile ship (overview + exam-variant selector + topic list) without also committing to the LLM grading architecture in the same PR.
- Account deletion isn't built yet, so the `CASCADE` behavior on `user_id` is untested in practice — noted here so it isn't a surprise once that feature exists.
