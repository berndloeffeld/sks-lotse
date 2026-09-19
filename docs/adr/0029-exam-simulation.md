# 0029. Exam simulation

Status: Accepted

## Context

Learners want to try the theory exam under realistic conditions, look at earlier attempts, and see their development. There is no LLM grading yet, so the learner has to assess their own answers ([ADR-0023](0023-self-assessed-learning-flow.md)).

The official rules are in the *Durchführungsrichtlinien Sportküstenschifferschein* (Nr. 6.2, 7.1, Anlage 1; [published by SUB e. V.](https://sub-ev.de/SUB/Kurse/SKS-Theorie/Richtlinien-SKS.pdf)): the written exam has two parts, a **Fragebogen** (90 minutes, 60 points; ≤ 32 failed, 33–38 oral re-examination, ≥ 39 passed) and a **Kartenaufgabe** (90 minutes, 30 points). The Richtlinien only demand a "wohlausgewogener Querschnitt" of the four subjects for the Fragebogen. The exam bodies' published layout, repeated by several course providers, is **30 questions: 9 Navigation, 7 Schifffahrtsrecht, 5 Wetterkunde, 9 Seemannschaft**, i.e. 2 points per question. That split is not in the Richtlinien text itself.

## Decision

- **Scope: the Fragebogen only.** The Kartenaufgabe needs chart images, which are not extracted yet (`image_ref` is always null). The UI says so wherever a result is shown.
- **Composition at start** (`app/core/exam.py`): random sample per subject group from the questions of the learner's exam variant (Seemannschaft = `seemannschaft_allgemein` plus the variant-specific subject). The exam variant is required and snapshotted on the attempt.
- **Time limit is enforced by the server**: `deadline_at = started_at + 90 min`. There is no scheduler; an attempt past its deadline is submitted lazily, the next time it is read or written (`timed_out = true`, `submitted_at = deadline_at`), and further answers get `409`. The client counts down from `deadline_at`, corrected by the server's `server_now`, so reloads and clock skew don't matter.
- **Flow**: answer everything (autosaved), submit, then self-assess question by question with the official answer shown. Official answers are withheld from the API until the exam is submitted. One running exam per learner (`409` otherwise). After the last self-assessment the attempt is complete and final.
- **Status is derived, not stored** (`submitted_at` / `graded_at`), as are points and result: no state to get out of sync.
- **Points from the self-assessment**: Richtig 2, Teilweise Richtig 1, Falsch 0. The Richtlinien leave point allocation to the examiners, so this mapping is our assumption.
- **No tips.** The exam never offers a tip, neither while answering nor in the review. (Tips don't exist in the app yet; when they do, this stays true.)
- **Separate from the Lernstand**: exams don't touch `question_progress`, so a good exam result doesn't mark questions "gelernt" and practice isn't distorted by test runs.
- **Data**: `exam_attempts` (`user_id` CASCADE, index `(user_id, started_at)` for the list) and `exam_attempt_questions` (`attempt_id` CASCADE, `question_id` SET NULL so a question dropped in a catalog re-sync doesn't delete history). Statistics (count, pass rate, average, best, last 10, share per subject) are computed on read from the learner's own attempts, which is cheap at this volume.
- **Privacy**: attempts hold the learner's free-text answers, so they are personal data: deleted with the account (`delete_user_and_progress`), included in the admin DSGVO export, deletable one by one by the learner (`DELETE /exams/{id}`), and described in the Datenschutzerklärung. They are kept while the account exists; no cleanup job is needed since they are user-owned records, not transient data.
- Endpoints under `/api/v1/exams`, JWT-protected; the default per-IP rate limit is enough (the client debounces autosave).

## Consequences

- A learner can only see and delete their own attempts; someone else's id is a `404`.
- Answers typed after the deadline are lost by design; the last autosave counts.
- A completed exam can't be re-graded, so a misclick in the self-assessment stands.
- If the official split or scoring differs from what course providers publish, the constants in `app/core/exam.py` are the single place to change; old attempts would keep their stored questions but be re-scored with the new mapping.
- Adding the Kartenaufgabe later means a second part with its own 90 minutes and 30 points; the "Fragebogen" wording in the UI is there to make that extension natural.
