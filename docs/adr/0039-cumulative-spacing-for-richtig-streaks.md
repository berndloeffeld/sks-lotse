# 0039. Cumulative spacing for unbroken "Richtig" streaks

Status: Accepted

## Context

[ADR-0034](0034-half-life-model-for-gelernt.md)'s spacing effect measures every "Richtig" against only the grading right before it: `s = min(elapsed / half_life, 1)`. That's deliberately harsh for a single well-spaced review, but it also makes *recovery* after a setback harder than intended. Once half-life `h` has grown even a little, a further quick re-confirmation is judged against that already-grown `h`, so each subsequent step within the same walk needs a longer real-world gap than the one before it to earn full credit — the opposite of "it finally clicked, and a few more correct answers in the following days confirmed it."

Worked example ("Frage 3" from testing the model by hand): four "Richtig" answers close together (mornings/evenings across three calendar days) right after a setback still only reached `h ≈ 3.6` days — nowhere near the 7-day "gelernt" bar — because each step's spacing was judged against the tiny half-life left over from the setback, not against how long the learner had actually been getting it right.

Two fixes were considered and rejected:
- **Raise `FULL_GAIN` (or lower `RECALL_THRESHOLD`)**: makes recovery faster in general, but the project has an explicit invariant — *2 "Richtig" must never be enough to reach "gelernt", even in the best case* — which requires `FULL_GAIN < sqrt(LEARNED_HALF_LIFE_DAYS / INITIAL_HALF_LIFE_DAYS) ≈ 2.646`. Values that noticeably help recovery (tested up to 3.5) break that invariant.
- **A discrete "3× Richtig in a row on 3 different days" gate, OR-combined with the continuous criterion**: solves recovery directly, but decouples "gelernt" from the half-life entirely for that path — a question could reach "gelernt" with an arbitrarily short half-life, undermining the reason ADR-0034 replaced the old streak rule (ADR-0018) in the first place.

## Decision

Within an **unbroken streak of "Richtig" gradings**, spacing is now measured cumulatively from the streak's first "Richtig", not from the previous grading. `question_progress.streak_start_at` (nullable) stores that start; a "Teilweise Richtig" or "Falsch" resets it to `NULL`, and the streak's first "Richtig" — whether it's the question's very first grading or the first one after a setback — sets it and is otherwise unaffected (it's still judged against the previous grading, same as before this ADR).

Concretely, `apply_grading()` (`backend/app/core/progress.py`) picks the reference point:
- First grading ever, or first "Richtig" after a setback: elapsed = time since the previous grading (unchanged).
- Every later "Richtig" in the same streak: elapsed = time since `streak_start_at` (cumulative).

**The 2-Richtig invariant is preserved by construction, not just by these examples:** a streak's *second* member always has `streak_start_at` equal to the previous grading's time, so cumulative and per-step spacing are identical there — the new measurement only ever changes the 3rd member of a streak onward. The best-case bound from ADR-0034 (`FULL_GAIN² < LEARNED_HALF_LIFE_DAYS / INITIAL_HALF_LIFE_DAYS`) therefore still holds unchanged.

Re-run through the worked example: the same four quick "Richtig" now reach `h ≈ 6.4` days instead of `≈ 3.6` — closer, though this particular data point still falls short of 7; a fifth well-spaced "Richtig" clears it. That's judged acceptable: the point was to reward a genuine recovery streak more, not to guarantee any specific hand-picked example crosses the line.

No backfill: existing rows get `streak_start_at = NULL`, which is exactly the safe "no known streak" state — their next "Richtig" falls back to the old single-step spacing, same as a genuinely new streak. The admin GDPR export (`AdminQuestionProgressExport`) lists the new column, like the others on this table.

## Consequences

- Recovery after a setback is still slower than never having had one (each streak's first two members are unaffected), but no longer punishes *staying* on a roll — the longer an unbroken streak runs, the more a further quick check-in is worth, which matches "once it clicks, it clicks."
- `is_learned()`, `learned_clause()`, `progress_fraction()`, `due_at()` and the resurfacing behavior are all unchanged — this ADR only changes what `elapsed` is measured against inside an active streak, not what half-life means or how "gelernt"/decay work.
- `next_half_life()` itself stays a pure function of one `elapsed` value; it doesn't know about streaks. All the new logic lives in `apply_grading()`, which now also has to read and write `streak_start_at`.
- The course gauge ([ADR-0024](0024-course-gauge-without-visible-step-count.md)) needs no change: it already only renders a 0–1 position derived from `half_life_days`, with no notion of streaks.
- Rejected alternatives (raising `FULL_GAIN`/lowering `RECALL_THRESHOLD`; a discrete OR-gate) are recorded above — revisit if a future change needs recovery to be faster than this gets it, since both remain available levers, just not chosen here.
