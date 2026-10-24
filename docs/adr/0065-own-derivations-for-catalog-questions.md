# 0065. Own derivations for catalog questions, from a reviewed YAML, marked as not official

Status: Accepted; amended by [ADR-0071](0071-sbf-navigation-runs-and-lotsen-check.md): the one exception, SKS Lotse's own tolerances go to the SBF Navigationsaufgaben's check, marked as not official

## Context

Many catalog answers are short results without the reasoning behind them. Schifffahrtsrecht Nr. 79 is an example: "Backbordfahrwassertonne; die nächste Tonne hat die Aufschrift 32". To get there you need the Betonnungsrichtung of the Elbe, the fact that elbabwärts runs against it, the even numbers on Backbordtonnen, the letter on an added buoy, and that the numbers count up in Betonnungsrichtung. A learner who answered "rote Lateraltonne, 30" sees that they were wrong, but not why.

The Kartenaufgaben already show a **derivation** under "Herleitung anzeigen" ([ADR-0052](0052-chart-exercises-from-reviewed-yaml.md), [ADR-0053](0053-chart-solutions-transcribed-as-text.md)), but that one is the WSV's own working, copied from the solution sheets. For catalog questions no official derivation exists. Anything we show there is **our own text**, and that runs into the rules:

- The official wording is never changed, and the catalog tables hold only what the data migrations take from the official catalog ([docs/catalog-pipeline.md](../catalog-pipeline.md)). Text of our own must not end up in those tables, or look as if it came from there.
- An own explanation can be wrong. The official answer has to stay the yardstick, both for the learner's self-assessment and for the Lotsen-Check.
- Derivations get written by hand, one at a time, and never for all ~1,000 questions. Most questions won't have one.

## Decision

- **Looks like the Kartenaufgaben, marked as not official.** The derivation folds out at the foot of the official answer, closed until the learner opens it ("Herleitung anzeigen"), the same as a Kartenaufgabe's derivation in its official solution (one shared `DerivationDetails`). Unfolded, its first line says "Von SKS Lotse erstellt, nicht Teil des amtlichen Fragenkatalogs. Maßgeblich ist die amtliche Antwort." The official answer above it stays as it is.
- **Content lives in a reviewed YAML, not in the database.** `backend/app/data/catalog_derivations.yaml` holds one entry per question, keyed by the natural key `subject` + `number`. Each entry has:
  - `blocks`: the derivation, in the Kartenaufgaben format (`text` paragraphs and `table` rows, `**bold**` for intermediate results). `ChartDerivationBlock` and its frontend rendering move to a shared `DerivationBlock` (`app/schemas/derivation.py`) / `DerivationText` (`components/Derivation.tsx`).
  - It leads only to the official answer, in plain words and as few steps as possible: no background the question doesn't ask for, nothing about any learner's answer.
  - `answer_fingerprint`: a short hash of the official `answer_text` the derivation was written against (`catalog_derivations.fingerprint`, the first 12 hex digits of its SHA-256).

  The backend loads the file once per process, the way it loads the Kartenaufgaben (`app/services/catalog_derivations.py`). A correction is a commit. A human writes or reviews every entry. An LLM may propose a draft, but nothing goes in unreviewed.
- **Tests guard the link to the catalog.** One test fails when a key matches no catalog question. Another fails when a fingerprint no longer matches the current `answer_text`, e.g. after a new catalog edition. The derivation is then checked again before the fingerprint is updated.
- **Delivery.** `QuestionRead` gains `derivation: list[DerivationBlock]`, empty when there is none (backward compatible for one deploy). `export_catalog.py` writes the same list into `catalog.gen.json`, so guests in "Lernen nach Thema" see it too ([ADR-0054](0054-learning-by-topic-open-without-login.md)). The CI staleness test already covers that file.
- **Only after the answer.** The derivation shows only where the official answer is visible: practice after revealing, the exam's grading and result, the topic's question list. Before answering it would be a tip, with the cap from [ADR-0038](0038-tip-reveal-caps-grading-outcome.md). Shown afterwards, it doesn't change grading.
- **Not sent to the Lotsen-Check.** The check keeps grading against question, official answer and the learner's answer only. Our own text must not become the yardstick, and an error in it must not change a grade.
- **No flag.** A question without an entry looks exactly as it does today. Rollout is just adding entries, starting with questions whose official answer is a bare result (buoyage, lights, priority rules).

## Consequences

- The tables stay purely official. Own content is in a separate file, and the UI says it is ours as soon as it is unfolded.
- No migration, no sync and no admin editor: at a few dozen to a few hundred entries a YAML file and a review are enough ("avoid pipeline overkill").
- Errors in a derivation are ours. Learners report them through the existing question report ([ADR-0030](0030-question-reports-and-feedback-channels.md)). The report form could gain a "Herleitung" reason later if reports need to be told apart.
- The fingerprint makes a new catalog edition visible: every derivation whose answer changed fails CI until someone has looked at it.
- `catalog.gen.json` grows with each entry, and the guests' topic pages carry the derivations as well.
- Rejected:
  - A `derivation` column on `questions`. It would put own text into the official tables, and every correction would need a data migration.
  - Derivations generated on the fly by an LLM. They would be unreviewed, cost money per view, and could contradict the official answer.
  - A box of its own beside the official answer (tried first, with a dashed rule): clearer in its separation, but it looked different from the Kartenaufgaben for the same thing. The line in the unfolded part carries the "not official" instead.
  - Showing it before the answer as a tip. That is what [ADR-0038](0038-tip-reveal-caps-grading-outcome.md) is for, and it is a different thing.
