# 0051. A grading log for the admin's per-question history

Status: Accepted

## Context

The operator wants to see, for one question, when each learner graded it, how, and which memory half-life ([ADR-0034](0034-half-life-model-for-gelernt.md), [ADR-0039](0039-cumulative-spacing-for-richtig-streaks.md)) came of it — to check that the model behaves as intended on real data and to answer "why is this question (not) gelernt?".

`question_progress` holds only the current state per (user, question); every grading overwrites it. Practice and Fokus gradings leave no other trace, and exam attempts only store the self-assessment, not the half-life. So the history can't be derived from what's stored.

Options considered:
- **Recompute on read** by replaying gradings through `apply_grading`: still needs the gradings themselves, and would show what today's model makes of them rather than what the learner saw at the time.
- **Snapshot columns on `question_progress`** (e.g. the last N gradings as JSON): bounded, but loses older history and makes a hot row wider.
- **An append-only log table**, one row per grading.

## Decision

A new table `question_grading_log` (`user_id`, `question_id`, `outcome`, `graded_at`, `half_life_days`), written in `services/progress.py` right after `apply_grading` in both write paths — the single grading (`record_grading`) and the batched exam credit (`credit_correct_answers`) — in the same transaction as the progress row. `half_life_days` is the value *after* the grading, as stored then; it is not recomputed.

`GET /admin/questions/{id}/history` returns it grouped per learner (email, gradings oldest first, most recently graded learner first). The admin opens it per question from the question search on `/admin/questions`. The learner UI still never shows half-life numbers ([ADR-0024](0024-course-gauge-without-visible-step-count.md)); this is an operator view only.

The log is personal data: it's deleted with the account (`services/user.py`), part of the Art. 15/20 export (`question_gradings`) and named in the Datenschutzerklärung.

## Consequences

- The history starts with this migration; earlier gradings were never recorded and can't be backfilled.
- The table grows by one row per grading and is not cleaned up while the account exists — at the expected load (NFR Mengengerüst) that's tens of short rows per learner per session, small enough to keep for the account's lifetime. If it ever matters, a retention cut-off can be added to the existing cleanup paths.
- Indexed on `(question_id, graded_at)` for the admin read and on `user_id` for deletion and export.
- Rejected: replay on read (shows today's model, not the recorded value) and snapshot columns (lossy, widens the hot row).
