# 0061. The learner chooses whether a Probeprüfung counts for the Lernstand

Status: Accepted — supersedes [ADR-0037](0037-exam-richtig-answers-feed-the-lernstand.md).

## Context

[ADR-0037](0037-exam-richtig-answers-feed-the-lernstand.md) let an exam's "Richtig" answers feed the Lernstand and kept "Teilweise Richtig" and "Falsch" out of it. That fits a learner who uses the exam as a final check, but not one who uses it as practice under exam conditions: a question they got wrong in the exam stays "gelernt" and doesn't come back in Auffrischen. Others want the opposite, an exam that changes nothing, as a pure rehearsal. One fixed rule can't serve both, and a half-way rule (only the good grades count) is hard to explain.

## Decision

- A setting of the account, `users.exam_counts_for_progress`, **on by default** (new and existing accounts alike), switched by a checkbox right above "Probeprüfung starten" (`PATCH /auth/me`).
- Each exam takes a copy at its start, `exam_attempts.counts_for_progress`, the same way it keeps its exam variant. Switching the setting later changes neither a running exam nor one whose self-assessment is still open. The result shows whether the exam counted.
- **On**: when the last question is graded (the moment `graded_at` is set), every question's final grade goes through the same grading as in practice — "Richtig", "Teilweise Richtig" and "Falsch" alike (`record_exam_gradings` in `app/services/progress.py`, the batched counterpart of `record_grading`). A setback lowers the half-life and can't itself grant "gelernt" (ADR-0050).
- **Off**: the exam doesn't touch the Lernstand at all (as ADR-0029 originally had it). History and statistics are kept either way.
- Unchanged from ADR-0037: nothing is recorded before the self-assessment is complete, each question counts once with its final grade, and a question dropped from the catalog since the draw is skipped.

## Consequences

- With the default on, a bad exam now demotes questions, also for accounts that had ADR-0037's rule before; exams already on record whose self-assessment is still open count with all three grades once it is finished (the migration sets both columns to true). Intended: it's the behaviour the learner can now switch off.
- The grading log (ADR-0051) records exam setbacks too, so the admin's question history shows them.
- The recording runs in one transaction (one query for the questions, one for the progress rows, one commit); only a concurrent first grading of the same question makes it fall back to one commit per question. If that fallback fails midway, the exam is complete with part of its grades missing, and it isn't retried.
- Rejected: a per-exam choice without a remembered default (one more decision before every start), the setting only in the profile (far from where it matters), and keeping ADR-0037's "only Richtig" as a third mode (more to explain than it's worth).
