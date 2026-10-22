# 0066. Lotsen-Check with the official answers of the question's topic, on Haiku 5.5

Status: Accepted — amends [ADR-0031](0031-ai-answer-check-with-claude-haiku.md) (what the check sends, the model, the output cap).

## Context

The check of a catalog question ([ADR-0031](0031-ai-answer-check-with-claude-haiku.md)) sent the question, its official answer and the learner's answer, nothing else. That left the model without a yardstick for anything the learner wrote beyond the official answer. It fell back on its own knowledge of German maritime law, and that knowledge is unreliable in the detail the SKS asks for.

A learner's answer to Schifffahrtsrecht Nr. 64 (the rules for Sportfahrzeuge in the Nord-Ostsee-Kanal) shows it. The answer named all three points of the official answer and added that sailing is forbidden on the NOK, and that boats under engine may set sails as well. Both statements are the official answer to Nr. 65. The check marked them as contradicting the rules and suggested "teilweise richtig".

A statement that the question doesn't ask for should cost nothing if it is true. If it is false, it should count against the answer. The catalog itself is the reliable source for that judgement, and the statements a learner adds usually come from a neighbouring question: Nr. 64–67 and 81 all deal with the NOK, and all belong to the topic `seeschstro-kennzeichnung`.

We measured before deciding. A set of 12 hand-written answers held true and false extras, extras in the catalog and extras outside it. 69 more answers were generated from 20 random questions: the official answer verbatim; the official answer plus another official answer of the same topic; the first half of the official answer; and an official answer from another subject. Results, as expected / total:

| | hand-written | verbatim | plus a topic answer | half | other subject | total |
|---|---|---|---|---|---|---|
| Haiku 4.5, no topic (before) | 7/12 | 20/20 | 5/20 | 9/9 | 20/20 | 61/81 |
| Haiku 4.5, with topic | 6/12 | | | | | |
| Haiku 5.5, no topic | 9/12 | | | | | |
| **Haiku 5.5, with topic** | **12/12** | **20/20** | **18/20** | **9/9** | **20/20** | **79/81** |

Haiku 4.5 marks down every statement beyond the official answer, true or false, whatever the prompt says. It also takes no help from the topic: once the topic was there, it declared a true statement false. Haiku 5.5 without the topic accepts true extras, but also false ones ("Segeln ist auf dem NOK erlaubt" came back as "richtig"). Only the two together judge extras the way the catalog does. Of the two misses, one is a check that called the appended neighbour answer off-topic and gave the fallback reply. The other marked down an appended sentence as not belonging to the question. Both come from appending a whole foreign answer, which a learner rarely does.

A second, larger run confirmed this. It used 219 cases: up to two questions per topic, a true line from another answer of the topic appended, and a line from the topic with a falsified number appended. The branch ran twice, Haiku 4.5 once.

| | true line appended | falsified line appended | all cases |
|---|---|---|---|
| Haiku 4.5, no topic (before) | 23/50 | 28/41 | 174/219 (79 %) |
| **Haiku 5.5, with topic** | **92/100** | **74/82** | **420/438 (96 %)** |

Most misses with a true line are the test's own fault: the line is right for its own question but reads as a claim about this one, and the model is right to object. The real weakness is the other column. A false statement far from the question is sometimes passed over as not asked. A prompt sentence saying that a false statement always counts, even when it doesn't belong to the question, made no measurable difference (419/438, 75/82), so the prompt stays without it.

## Decision

- **The check sends the topic.** In front of the question, a `<thema>` block holds every other question of the same subject and topic that has a text answer, each with its official answer, in catalog order (`topic_entries`, `topic_block` in `app/services/grader.py`). A question without a topic gets no block. Only official catalog text goes in. SKS Lotse's own derivations ([ADR-0065](0065-own-derivations-for-catalog-questions.md)) never do.
- **The prompt says how the topic counts.** It never earns points for this question. A statement beyond the official answer that the topic confirms, or that appears nowhere in it, costs nothing and does not go into `fehlt`. A statement that contradicts the official answer or an answer in the topic is something false: at most `teilweise_richtig`, and it goes into `fehlt` with what is right.
- **The model is `claude-haiku-5-5`** (`ANTHROPIC_GRADING_MODEL`'s default). It reasons before replying (adaptive thinking at its default effort, `medium`). That reasoning made the difference in the measurement, so it stays on.
- **The output cap is 3,000 tokens** (`MAX_OUTPUT_TOKENS`). The reasoning counts as output. Measured over ~1,000 checks: median ~230 output tokens, at most 1,306. The old cap of 500 would have cut off the longest checks, and a reply cut off becomes a 503 with the token refunded. 3,000 is more than twice the measured maximum. Only what is generated is billed, so the headroom costs nothing in the normal case.

## Consequences

- **Cost goes down, not up.** Per check about 0.07 US cents on Haiku 5.5 with the topic, against 0.18 cents before: Haiku 5.5 costs a tenth per token ($0.10 / $0.50 per million), which more than pays for the topic (~2,500–3,500 more input tokens for a typical one) and the reasoning. The largest topic (51 questions) adds about 10,000 input tokens, about 0.1 cent. No prompt caching: the topic varies per check and the volume is small.
- **Latency:** median 2.2 s, 90th percentile 4.2 s, slowest 11.4 s in ~1,000 checks (before: 2.1 / 2.9 / 6.4 s). The 15 s timeout stays; the slowest check came close to it, so its share of timeouts is worth watching in the logs.
- **What leaves for Anthropic grows by catalog text only.** The topic's official questions and answers are public, official text with no reference to the account, so nothing changes in what is personal. The product rule in `CLAUDE.md`, the Datenschutzerklärung and the docs list it now.
- **Statements outside the catalog are still judged by the model's own knowledge.** In the measurement it caught a false one ("mit Radar nachts durch den NOK") because the claim contradicts the official answer itself, and let a true one pass ("15 km/h"). Without the catalog as a yardstick, that remains a judgement, not a check.
- The Kartenaufgaben check ([ADR-0058](0058-lotsen-check-for-chart-exercises.md)) is unchanged: Sonnet, its own prompt, no topic.
- Rejected: **the whole catalog as context** (~40,000 input tokens per check, most of them about other subjects). **Haiku 4.5 with the topic**: no better than without it, and once worse. **Sonnet**: unnecessary at these results, and 20 times the per-token price of Haiku 5.5.
