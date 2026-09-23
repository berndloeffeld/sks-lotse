# 0038. Tip reveal caps grading outcome to "Teilweise Richtig"

Status: Accepted — restates the tip rule of [ADR-0018](0018-learning-progress-model-and-gelernt-streak-rule.md) as its own decision; not enforced yet, since tips aren't built.

## Context

[ADR-0034](0034-half-life-model-for-gelernt.md) introduced a half-life model to measure long-term retention. Without safeguards, a learner could peek at a question's hint and still be awarded full credit ("Richtig"), gaming the system by using tips as a shortcut to earn "gelernt" status without genuine learning.

The mockups for the question-answering flow (`Question.dc.html`, `GradingTip.dc.html`) from 2026-09-17 included a per-question optional tip (text or image) that a learner can reveal during an attempt. This ADR formalizes the behavioral contract.

## Decision

While answering a question, a learner may optionally reveal a **tip** via a "Tipp anzeigen" control. Once revealed for a given attempt, that attempt's grading is capped at "Teilweise Richtig" — "Richtig" is excluded as a possible outcome for that submission.

Implementation:
- The client sends a `tip_revealed: bool` flag alongside the answer submission to the backend.
- The grading logic (whether self-assessed or LLM-based, [ADR-0031](0031-ai-answer-check-with-claude-haiku.md)) rejects or downgrades any "Richtig" result to "Teilweise Richtig" when `tip_revealed` is true.
- The `questions` table gains a `tip` column (nullable, text or image reference) to store the hint content itself; the implementation (single text/image column or separate columns) is deferred.

## Consequences

- Prevents gaming the half-life model by peeking and still earning full credit.
- Learners are still incentivized to attempt without hints, knowing that a hint precludes a perfect score for that question.
- The rule is transparent in the UI: the "Tipp anzeigen" control includes a note that using it limits the best outcome to "Teilweise Richtig".
- If a learner later answers the same question again without a tip, they can earn "Richtig" on that new attempt.
- Not yet enforced (no question has tips as of 2026-09-22); this ADR codifies the behavior once tips are added to the catalog.
