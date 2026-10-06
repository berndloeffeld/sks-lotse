# 0058. Lotsen-Check for the Kartenaufgaben: Sonnet, the derivation and the run's earlier answers, stored, 2 tokens

Status: Accepted — amends [ADR-0031](0031-ai-answer-check-with-claude-haiku.md) and [ADR-0043](0043-token-based-ai-grading-monetization.md) (a second kind of check, on another model, at 2 tokens) and [ADR-0052](0052-chart-exercises-from-reviewed-yaml.md) (the AI check it left for later).

## Context

A Kartenaufgabe run is self-assessed in points ([ADR-0052](0052-chart-exercises-from-reviewed-yaml.md)): the learner notes the result, sees the official solution, gives themselves points. Since [ADR-0053](0053-chart-solutions-transcribed-as-text.md) the solution is text, with its tolerances, and so is its **derivation**: every intermediate value of the course conversion (MgK → Abl → mwK → Mw → rwK → BW → KdW → BS → KüG), the tide table, the stream diamond and the hour relative to HW Helgoland. That is exactly what's needed for more than a grade: recomputing how the learner's number came about, and so where they probably went wrong — a sign the wrong way round, MESZ forgotten, 1,94 h read as 1 h 94 min, a bearing without ±180°.

What differs from the catalog check ([ADR-0031](0031-ai-answer-check-with-claude-haiku.md)):

- **The work is arithmetic, not a comparison of statements.** Haiku is cheap and fast at "does this answer name the points of the model answer"; working backwards through a chain of signed corrections is where a stronger model pays off.
- **Tasks build on each other.** Task 6 takes the distance of task 5, a Besteckversetzung the Koppelort of the task before. A wrong value can be a follow-on error, which the model can only see with the earlier tasks and the learner's answers to them.
- **The answer is already stored**, once, before the solution shows ([ADR-0052](0052-chart-exercises-from-reviewed-yaml.md)); it can't be rephrased.
- **One solution part is a drawing** (the current triangle, one per sheet), which scores and which the model can't see.

## Decision

- **One call per answered task**, `POST /chart-exercises/attempts/{id}/tasks/{n}/ai-check`, for the current task once answered and before its points are given. It checks the stored answer; the request has no body. Same key as the catalog check, own setting `ANTHROPIC_CHART_GRADING_MODEL`, default **Claude Sonnet 5.5**, adaptive thinking at effort `medium`, timeout 45 s, with the API's server-side refusal fallback. The shared call (`services/grader.py:structured_call`) keeps the process-wide cap on calls in flight.
- **The prompt**: the sheet's rules (in the system prompt, cached), the earlier tasks of this run with their official results and the learner's answers (not their derivation, which keeps the prompt small), this task with its points per question, the official results with tolerances, the derivation, and the answer. Nothing about the account. Learner text is escaped and declared not to be instructions, as in [ADR-0040](0040-ai-grading-sanitizer-and-abuse-monitoring.md).
- **The reply**: feedback (what's right or wrong), the suspected mistake (only when the learner's value can actually be recomputed with it, otherwise "not clear"), and points — strictly by the official solution and tolerance; a follow-on error is named, not credited. The points are clamped to the task's. The sanitizer backstop applies, except that a short answer quoted back is normal here ("Dein KaK = 286° stimmt").
- **The suggestion is stored** with the answer (`chart_attempt_tasks.ai_points`, `ai_feedback`, `ai_suspected_error`): a reload shows it again and a second check of the same answer is refused (409) — it would cost tokens for the same result. It picks its points in the self-assessment; giving them stays the learner's step. It is personal data like the answer: deleted with the run and the account, in the admin export, in the Datenschutzerklärung.
- **2 tokens per check** (`TOKENS_PER_CHART_CHECK`): the model costs more per token and the prompt is several times longer. Shown on the button before the check. The hourly cap is the one the catalog check uses; a once-per-task cap guards against a double click paying twice; a check that fails costs nothing.
- **Not for a task with a drawing** (`ai_checkable` false): the drawing's point would be a guess either way.
- **Guests** see the check as a teaser, as in "Lernen nach Thema" ([ADR-0054](0054-learning-by-topic-open-without-login.md)): their run is never sent anywhere ([ADR-0056](0056-chart-exercises-open-to-guests.md)).

## Consequences

- The AGB said one token buys one check; they now say the price depends on the kind of task and is shown before the check — an AGB change every account confirms again.
- "The Lotsen-Check sends nothing but question, official answer and the learner's answer" no longer holds for the Kartenaufgaben: it also sends the run's earlier answers and the derivation. The Datenschutzerklärung says so, in terms general enough for both kinds of check.
- A check takes a few seconds longer than the catalog's; the endpoint holds a worker thread for up to the timeout, under the same cap on calls in flight.
- The model can be wrong about the cause; the UI calls it "Vermuteter Fehler" and the points a suggestion.
- Rejected: Haiku at 1 token — cheaper, but it guesses causes it can't recompute; checking numeric results against the tolerances in code — the answers are free text with several values in any order, and it would give points but no cause; a stateless check as for the catalog — the answer is fixed, so a lost suggestion could only be bought again; sending each earlier task's derivation too — a much longer prompt for little: the follow-on error shows from the results.
