# 0028. Focus topics

Status: Accepted

## Context

Learners want to concentrate on a few topics at a time and see, for exactly those, how far along they are. The Lernstand on `/learn` only showed per-topic "gelernt" counts (streak ≥ 3, [ADR-0018](0018-learning-progress-model-and-gelernt-streak-rule.md)) and gave no way to pick topics out or to tell "not started" from "on the way".

## Decision

- A learner marks topics as **Fokus** (star on each topic row of `/learn`). The marks live in a new table `focus_topics` — one row per `(user, topic)`, both FKs `ON DELETE CASCADE`, `UNIQUE(user_id, topic_id)` (its leading `user_id` serves the only read pattern, so no extra index). Set via `PUT /api/v1/progress/focus/{subject}/{topic_slug}`, cleared via `DELETE` on the same path; both idempotent. Marking a topic that is already fully learned is refused with `409`, since it would be removed again immediately.
- `GET /progress/summary` gains, per topic, `is_focus` and `learning_questions` — the questions "teilweise sicher gelernt", i.e. a streak of 1 or 2 (above 0, below `LEARNED_STREAK_THRESHOLD`). "Sicher gelernt" stays `learned_questions` (streak ≥ 3). A "Teilweise Richtig"/"Falsch" resets the streak to 0, so "teilweise" always means "some consecutive Richtig so far".
- The `/learn` Fokus band shows the combined sicher/teilweise/offen counts of all Fokus topics and lists them.
- **A Fokus topic leaves the focus automatically, and permanently, once every one of its questions is "gelernt".** The check runs in `grade_question`, only when that grading just made a question learned (`app/services/focus.py`), and deletes the row. It is not re-derived on read.
- Focus marks are personal data: deleted with the account (`delete_user_and_progress`) and included in the admin DSGVO export.

## Consequences

- A cheap check on the one write path that can complete a topic; reads stay plain lookups.
- Rejected: only *hiding* a completed topic (deriving it on read). Then a later streak reset would silently bring the topic back into the focus, which surprises more than it helps — the learner can simply mark it again.
- Rejected: a JSON column of topic ids on `users`. It would need its own cleanup when topics are re-synced and can't be joined or cascaded.
- A topic completed some other way than grading (e.g. a catalog re-sync that removes its last unlearned question) keeps its mark until the learner removes it or the next grading; acceptable at this scale.
- **Privacy**: focus marks are personal data. They are deleted with the account (`delete_user_and_progress`), included in the admin DSGVO export, and named in the Datenschutzerklärung.
