# 0034. Half-life model for "gelernt" (replaces the 3-streak rule)

Status: Accepted — the spacing measure for a run of "Richtig" is amended by [ADR-0039](0039-cumulative-spacing-for-richtig-streaks.md) (cumulative from the streak's start).

## Context

[ADR-0018](0018-learning-progress-model-and-gelernt-streak-rule.md) defined a question as "gelernt" after 3 consecutive "Richtig" gradings, any other outcome resetting the streak. Research on 2026-09-18 found that a pure trial streak — especially without spacing between the attempts — measures short-term rather than long-term retention: three right answers within one sitting count exactly like three spread over weeks, and a question stays "gelernt" forever however long ago it was answered. [ADR-0024](0024-course-gauge-without-visible-step-count.md) had already kept the UI independent of the rule (the gauge only draws a 0–1 position) in anticipation of this change.

The model the research pointed to is Duolingo's half-life regression: the probability of recalling an item decays as `p = 2^(-Δ/h)`, with `h` (the half-life) estimated per item and learner and re-estimated after every review.

## Decision

- `question_progress` replaces `correct_streak` with `half_life_days`, `last_graded_at` and `review_due_at` (`last_graded_at` plus the time until `p` falls to the recall threshold). One row per (user, question) as before; the migration converts an old streak `n` to the half-life `2.5^n` (0.25 days for a reset one), dated from the row's last update.
- A later addition (Fokus session, ADR-0028): `last_correct_at`, nullable, set only by a "Richtig" grading. Existing rows were backfilled with `last_graded_at` where the half-life is above the 1-day baseline, an approximation that only affects the Fokus session's order.
- **Update rule per grading** (`app/core/progress.py`, all constants there):
  - "Richtig" multiplies the half-life by `1 + 1.5 · s`, where `s = min(elapsed / half_life, 1)` — the *spacing effect*: answering right again straight away earns (almost) nothing, answering after a full half-life earns the full ×2.5. A question's first grading counts as `s = 1`.
  - "Teilweise Richtig" halves it, "Falsch" quarters it. Bounds: 0.25 days to 365 days.
- **"Gelernt"** = half-life ≥ 7 days **and** the estimated recall probability still ≥ 0.7 (`review_due_at` in the future). When it drops below, the question is no longer gelernt: it resurfaces in the practice run and the topic's gelernt count falls. Reaching it takes at least three well-spaced "Richtig" over roughly a week.
- "Teilweise gelernt" (`learning_questions`) = half-life above the 1-day baseline but not (or no longer) gelernt.
- Because `review_due_at` is stored, "gelernt" stays a plain SQL filter (`learned_clause()`), used by the summary, the Fokus check and the KPI report; `is_learned()`/`progress_fraction()` are its Python twins for single rows.
- The API returns `{question_id, progress, learned}` instead of `correct_streak`; `progress` is a 0–1 position for the gauge that only reaches 1 when the question is gelernt. The admin DSGVO export lists the three new columns.
- The tip rule from ADR-0018 (a revealed tip caps the outcome) is unaffected; still not enforced, since no question has tips.

## Consequences

- Cramming no longer produces "gelernt": the learner is nudged to come back on other days, which is the point. Expect the counts on `/learn` to move more slowly and to go *down* when a learner stays away — the FAQ explains this without giving numbers (ADR-0024 still holds).
- Accounts migrated from the streak rule mostly lose their old "gelernt" status if idle, by design.
- **Not a trained regression.** Duolingo fits feature weights on millions of reviews; we have none. The fixed factors above are a heuristic in the same family (exponential forgetting curve, half-life updated per review) and can be tuned — or replaced by a fitted model — once real grading data exists. The names and the column semantics don't have to change for that.
- Rejected: keeping the streak and adding a minimum time between attempts — simpler, but leaves "gelernt" permanent and gives no principled basis for resurfacing.
- Rejected: a full SM-2/Anki scheduler with due dates as the primary concept — the UI is topic-practice, not a daily review queue; the half-life fits the existing "gelernt" counts.
- Resurfacing today only affects what a practice run offers and the counts. A dedicated "Wiederholen" queue across topics is possible later on top of `review_due_at`.
- A Fokus topic still drops out permanently once all its questions are gelernt ([ADR-0028](0028-focus-topics.md)); later decay doesn't bring it back.
