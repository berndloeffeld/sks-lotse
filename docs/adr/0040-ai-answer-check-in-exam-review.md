# 0040. AI answer check in exam review

Status: Accepted

## Context

The AI answer check ([ADR-0031](0031-ai-answer-check-with-claude-haiku.md)) only existed in the practice self-assessment step (`PracticeRun`, used by `PracticePage`/`FocusPracticePage`). The exam simulation ([ADR-0029](0029-exam-simulation.md)) offered manual Richtig/Teilweise Richtig/Falsch self-assessment only, in `ExamGrading`.

ADR-0029's "no tips" rule ("the exam never offers a tip, neither while answering nor in the review") could be read as ruling this out too, but it is about a different, still-unbuilt feature (a per-question hint shown before or during answering, see [ADR-0038](0038-tip-reveal-caps-grading-outcome.md)). By the time `ExamGrading` runs, the exam is already submitted and the official answer is already shown for self-assessment — exactly the state in which practice offers the AI check. Withholding it there protects nothing that isn't already visible.

## Decision

- `ExamGrading` now renders the same `AiAnswerCheck` component practice uses, right after the grading fieldset, gated on the question having an official answer and a live catalog `question_id` (a question that fell out of the catalog can't be graded).
- It calls the same `POST /questions/{id}/ai-grade` endpoint and preselects the suggested outcome the same way practice does; the learner still confirms via the manual grade save (`PUT /exams/{id}/questions/{position}/grade`).
- **No separate exam budget.** The endpoint resolves `question_id` against the general catalog regardless of caller, and the weekly quota (`ai_quota.py`, `GRADING_MAX_PER_WEEK`, [ADR-0036](0036-weekly-ai-check-budget-with-admin-overrides.md)) is keyed only by `user_id`/`question_id` — exam checks draw from the same weekly pool as practice checks. No backend change was needed.

## Consequences

- A learner who spends most of their weekly AI checks in an exam run has fewer left for practice that week, and vice versa — one shared budget, not two.
- Keyboard flow (Tab cycling, Enter-to-confirm) had to be duplicated into `ExamGrading` rather than shared, since it only had an index-based `cycleFocus` before; it now mirrors `PracticeRun`'s element-based version so the AI-check button folds into the same Tab loop as the grade radios.
- Rejected: a separate exam-only budget — would need a new counter and admin-override surface for a distinction (practice vs. exam) that doesn't otherwise exist anywhere in the grading or quota code, for a difference in kind (self-assessment help) that isn't in the data.
