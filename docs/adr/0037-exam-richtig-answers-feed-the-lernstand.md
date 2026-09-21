# 0037. Correct exam answers feed the Lernstand

Status: Accepted

## Context

[ADR-0029](0029-exam-simulation.md) kept exams out of `question_progress` so that test runs wouldn't distort practice. That was decided under the streak rule. With the half-life model ([ADR-0034](0034-half-life-model-for-gelernt.md)) it costs more than it protects: an exam answer is a genuine, unaided retrieval attempt (no tips, time pressure, a long spacing since the last practice), and the learner who answered a question correctly in an exam saw it as "gelernt" only after answering it again in practice. The half-life update already weights a "Richtig" by the spacing since the last grading, so it doesn't need protection from exam runs.

Grades can be changed freely while the self-assessment is open (`PUT /exams/{id}/questions/{position}/grade` overwrites `outcome` until the last question is graded), so updating on every call would count repeated or revised grades more than once, and a "Richtig" later changed to "Falsch" couldn't be undone.

## Decision

- When the last question of an exam is graded (the moment `graded_at` is set), every question with the final outcome **"Richtig"** goes through the same grading as a practice answer (`record_grading` in `app/services/progress.py`, shared with `POST /progress/questions/{id}`): half-life grows, `last_correct_at` and `review_due_at` are set, and a topic that thereby becomes fully learned drops out of the Fokus list.
- **"Teilweise Richtig" and "Falsch" never touch the Lernstand** from an exam: an unaided answer under time pressure is weaker evidence of forgetting than of remembering, and a bad exam shouldn't demote questions the learner practiced.
- Nothing is credited before the exam is complete, so an abandoned or half-graded exam changes nothing, and each question counts once with its final grade.
- Questions dropped from the catalog since the draw (`question_id` is `NULL`) are skipped.

## Consequences

- A good exam moves the "gelernt" counts and the Fokus band; it can no longer be used as a risk-free rehearsal for the Lernstand. That is intended.
- Crediting runs after the exam-completing commit, in one commit per question. If it fails midway, the exam is complete but part of the credit is missing, and it isn't retried (a completed exam can't be re-graded). Acceptable at this scale; the alternative, one transaction, would need savepoints around the concurrent-first-grading fallback and isn't worth it.
- Supersedes only the "Separate from the Lernstand" bullet of ADR-0029; the rest of that decision stands. Exam history and statistics stay separate from the Lernstand.
