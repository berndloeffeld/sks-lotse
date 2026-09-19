# 0023. Self-assessed learning flow as the first write path to progress

Status: Accepted

## Context

[ADR-0018](0018-learning-progress-model-and-gelernt-streak-rule.md) built `question_progress` and a read-only Lernstand, but nothing wrote to it: the "Lernen starten" buttons on `/learn` were disabled, and every learner's progress read as zero. The planned writer was the LLM grading endpoint, which still waits on two things that don't exist: the entitlement model that gates it ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) and the OpenAI integration itself ([ADR-0003](0003-synchronous-grading-requests.md)).

ADR-0006 already fixed what a learner *without* AI grading gets: the official model answer, shown directly, for self-comparison. ADR-0014 designed the matching control: three plain radio buttons, Richtig / Teilweise Richtig / Falsch. That flow needs no LLM and no entitlements, and it is the one every free account will use anyway.

Options considered:
1. Wait for AI grading before letting learners answer anything.
2. Ship the self-assessment flow now, with self-assessed outcomes counting toward "gelernt" exactly like an AI grading would.
3. Ship self-assessment but keep it out of `question_progress` (practice without a Lernstand).

## Decision

Option 2.

- **Endpoint**: `POST /api/v1/progress/questions/{question_id}` with `{"outcome": "richtig" | "teilweise_richtig" | "falsch"}` records one grading and returns the question's new `correct_streak` and `learned` flag. The streak rule itself is a pure function, `next_streak()` in `app/core/progress.py`, next to `LEARNED_STREAK_THRESHOLD`. The future AI-grading endpoint moves the streak through the same function; only where the outcome comes from differs.
- `GET /api/v1/progress/questions` returns the caller's per-question streaks (only questions graded at least once; everything else is streak 0), so the client can pick unlearned questions and draw each question's Lot gauge.
- **Frontend**: `/learn/:subject/:topic` runs through a topic's not-yet-learned questions in random order. For each: question, an optional free-text field (a scratchpad, never sent to the server), "Lösung anzeigen", the official answer, the self-assessment, the moved Lot gauge. A run ends with a tally. Once a topic is fully learned, the learner can repeat all of it. The route carries the subject because topic slugs are only unique per subject.
- The tip rule from ADR-0018 (a revealed tip caps the outcome at "Teilweise Richtig") isn't enforced, because tips don't exist yet: no question has tip content. The request body is the place to add a `tip_revealed` flag once they do.

## Consequences

- The Lernstand is real now: the learner's own gradings drive the per-topic counts on `/learn` and `/profile`.
- Self-assessment is trust-based. A learner can click "Richtig" three times and mark anything as learned. That only affects their own progress, so it isn't worth defending against. It also means a self-assessed streak and an AI-graded one mean slightly different things. We accept that for now. If it starts to matter (e.g. an exam-readiness score), store the grading source alongside the streak.
- Every grading is one `POST`, well within the shared per-IP bucket (300 requests / 5 min). It needs no tighter rule of its own, unlike the future LLM call.
- The first grading of a question inserts the row. A concurrent double submit is caught via the unique constraint and applied on top of the winner's row, instead of failing.
- Rejected, option 1: it keeps the core loop unusable for an unknown time, for a feature most (free) accounts won't have anyway.
- Rejected, option 3: practice that leaves no trace makes the Lernstand pointless for exactly those free accounts.
