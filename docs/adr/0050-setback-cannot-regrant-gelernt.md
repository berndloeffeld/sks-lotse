# 0050. A setback grading can never itself (re)grant "gelernt"

Status: Accepted — amends [ADR-0034](0034-half-life-model-for-gelernt.md).

## Context

A learner reported a question that had drifted out of "sicher gelernt" (its `review_due_at`
had lapsed, per ADR-0034's resurfacing behaviour — working as intended) jumping straight back
to "sicher gelernt" after they answered it "teilweise richtig" — a setback, not a full recall.

`apply_grading()` (`backend/app/core/progress.py`) resets `review_due_at` to `now + decay(new
half_life)` after *every* grading, "teilweise richtig"/"falsch" included. That's correct: the
learner just saw the question and its answer, so the model reasonably treats recall as
momentarily confirmed and schedules the *next* check from here, at the (now shorter) half-life.
The bug was in the other half of `is_learned()`: `half_life_days >= LEARNED_HALF_LIFE_DAYS` alone
gates "gelernt", and the setback factors (half/quarter, ADR-0034) are multiplicative on
whatever half-life the question already had. A question with a long-enough half-life survives
a halving (needs ≥ 14 days before) or even a quartering (≥ 28 days before) and stays ≥ 7 —
so it read as "gelernt" again immediately, off a *single* imperfect or outright wrong answer.

That contradicts the project's own invariant from [ADR-0039](0039-cumulative-spacing-for-richtig-streaks.md):
"2 'Richtig' must never be enough to reach 'gelernt', even in the best case." Reaching "gelernt"
fresh already takes at least three well-spaced "Richtig" (ADR-0034); *recovering* it after a
setback should be at least as hard, not free.

## Decision

"Gelernt" additionally requires that the most recent grading was a "Richtig". `streak_start_at`
already carries exactly this: it's set on every "Richtig" (continuing or starting a streak) and
cleared to `NULL` on "Teilweise Richtig"/"Falsch" (ADR-0039). No schema change.

- `backend/app/core/progress.py`: `_at_learned_bar()` (the shared "half-life at the bar" check,
  used by `is_learned()` and its SQL twin) now also requires `streak_start_at is not None`
  Python-side, `streak_start_at IS NOT NULL` SQL-side (`_at_learned_bar_clause()`, used by
  `learned_clause()`, `refresh_clause()` and `lapsed_clause()` — all four stay consistent with
  a single source of truth, same as `learning_clause()` already derives from `learned_clause()`).
- A setback still shortens the half-life as before (ADR-0034's multiplicative factors are
  unaffected) and still schedules the next check via the shortened half-life — only the
  "gelernt" *label* requires a subsequent "Richtig" to reappear.

## Consequences

- A question that setbacks out of "gelernt" now shows as "teilweise gelernt" (`learning_clause()`)
  until the learner answers it correctly again, regardless of how large its half-life was before
  the setback — matching what the learner just demonstrated (a partial or wrong recall), not a
  stale numeric survivor of an earlier streak.
- The Auffrischen queue (`refresh_clause()`/`lapsed_clause()`, ADR-0049) and the Fokus-topic
  check (`services/focus.py`) no longer treat such a question as "was gelernt, now fading" either
  — it wasn't, as of its last grading.
- `backend/tests/helpers.py`'s `progress_state()` now sets `streak_start_at` to match the
  "graded `level` times Richtig in a row" state it already documents (`None` for level 0).
- Rejected: a new column dedicated to this check — `streak_start_at` already means exactly
  "the last grading was a Richtig" (whether starting or continuing a streak); reusing it keeps
  the fix a pure logic change.
