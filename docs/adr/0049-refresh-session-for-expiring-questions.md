# 0049. Auffrischen: a session for questions that lapsed or are about to

Status: Accepted

## Context

"Gelernt" is time-dependent ([ADR-0034](0034-half-life-model-for-gelernt.md)): a question counts while its half-life is at least 7 days *and* `review_due_at` is in the future. When the due date passes, the question quietly drops back to "not sicher gelernt" — its half-life is untouched, only the status flips. Nothing let the learner target exactly those questions: the topic run and the Fokus session ([ADR-0028](0028-focus-topics.md)) both work through what is *not* gelernt, so a question that is about to lapse is invisible to them until it already has.

## Decision

A third learning mode, **Auffrischen** (`/learn/refresh`), next to "Nach Thema" and "Fokus": a run of at most 20 questions that were sicher gelernt and have lapsed or lapse within two days.

- **Candidates:** `half_life_days >= LEARNED_HALF_LIFE_DAYS` and `review_due_at <= now + 2 days` (`refresh_clause`, `backend/app/core/progress.py`, next to `learned_clause`). That covers both "was gelernt, due date passed" and "gelernt, due within the window".
- **"Was gelernt" means the half-life reached the bar.** A question that was graded "Falsch" or "Teilweise" after it lapsed has a smaller half-life again and is no longer a candidate; it is plainly open and belongs to the normal runs.
- **Selection:** a random sample of `REFRESH_SESSION_SIZE` (20) from the candidates (`GET /progress/refresh/questions`), with at least 70 % (`REFRESH_LAPSED_SHARE`, 14 of 20) from the already lapsed ones; the rest are the soon-lapsing. Seats one pool can't fill go to the other (`refresh_quota`), so a learner with few lapsed questions still gets a full session. The picks are shuffled together. Random within the pools rather than most-urgent-first, so repeated sessions don't always show the same questions.
- **No effect on the model.** Grading works as before ([ADR-0023](0023-self-assessed-learning-flow.md), ADR-0034/0039); a "Richtig" on a lapsed question grows the half-life by the usual spacing rule, with no penalty for being late. No new column, no migration, no new personal data.
- **Client:** the run keeps still-gelernt questions (`keepLearned` in `PracticeRun`), which the other runs filter out. `/learn` shows the three modes as tabs (Nach Thema = the topic list, Fokus = the existing Fokus band, Auffrischen) under the overall progress, the selected one kept in the URL (`?modus=`). A first version with three cards plus the Fokus band and the topic list on one page was too crowded. The Auffrischen tab shows a bar and counts (`GET /progress/refresh/summary`: `lapsed` = due date passed, shown as "möglicherweise verblasst"; `expiring` = due within the window, "könnten bald verblassen"; `fresh` = still gelernt beyond it, "noch frisch") and its start button only while `lapsed + expiring > 0`. These are counts of questions, not model values. It shows no counts of the model ([ADR-0024](0024-course-gauge-without-visible-step-count.md)).

## Consequences

- Only questions that were once at the bar are offered: a learner who never reached "gelernt" sees an empty Auffrischen and is pointed to the other modes.
- The 2-day window and the sample size are constants, easy to tune; both are product choices, not derived from the model.
- Random selection within the lapsed pool means the sample can miss the most overdue question; if that turns out to matter, order by `review_due_at` instead.
