# 0026. Merge Seemannschaft I/II pairs only on matching wording; key Seemannschaft rows by official number

Status: Accepted — supersedes the merge criterion ("near word-for-word identical questions") of [ADR-0017](0017-official-topic-taxonomy-and-seemannschaft-merge.md) and refines the upsert key of [ADR-0022](0022-catalog-sync-by-upsert.md) for the three Seemannschaft subjects

## Context

ADR-0017 merged Seemannschaft I and II questions into `seemannschaft_allgemein` when their *question* texts were near-identical (`difflib`, threshold 0.75), keeping the Seemannschaft I wording, question **and** answer, for both exam variants. Answers were never compared. Once the question/answer split was fixed (PR #90, font-based split in `parse_catalog_pdf`), comparing the 106 reviewed pairs word for word (whitespace-normalized) showed that 31 of them differ in question or answer text, from a single comma up to a different question with a different list of items (S I #55 "Tanken von Diesel", 3 measures, vs. S II #45 "Tanken und Umfüllen von Brennstoffen", 5 measures).

For a Motor learner a merged row therefore sometimes showed wording that isn't in their official catalog. That conflicts with the conditions for using the catalog (ELWIS: an amtliches Werk, cite the source, no changes to the wording). In the worst cases it teaches the wrong answer list for their exam.

Un-merging a pair raises a second problem. `seemannschaft_allgemein` numbers are derived: a pair's position in the reviewed list. Removing one pair shifts every later number, and `sync_catalog()` upserts by `(subject, number)`. So every learner's progress on a later question would silently move to a different question.

## Decision

- **Every pair was decided by a human, one by one** (2026-09-19, from `backend/scripts/diff_seemannschaft_pairs.py`'s word diff), never by a script or an LLM:
  - **8 pairs un-merged** because their *content* differs: S I/S II #22/#14, #25/#17, #55/#45, #58/#46, #107/#87, #109/#90, #124/#105, #157/#140. Examples: extra or missing answer items, sailing-specific terms ("Fallen und Schoten", "kreuzen … auf") in a question shown to Motor learners. Each half now lives in `seemannschaft_segeln`/`_motor` with its own official text. The two pairs that were hand-paired in the original review (#55, #58) are among them.
  - **23 pairs accepted** as merged because the difference is *editorial* (synonym, word order, punctuation, spelling, including obvious typos in either catalog). A learner who knows either version answers the other correctly. Each carries a short `accepted_difference` rationale in `seemannschaft_duplicates.yaml`.
  - The criterion for future reviews is the same: accept only editorial differences, un-merge anything that changes what a correct answer contains.
- **The merge enforces it.** `merge_seemannschaft()` raises if a pair's question or answer differs and the pair has no `accepted_difference`. It runs in every data migration, so an unreviewed difference can't reach production. A test also flags a stale rationale on a pair that no longer differs. The proposal step (`merge_seemannschaft.py`) now records `answer_similarity` and lists every candidate that isn't word-for-word identical.
- **Seemannschaft rows are identified by their official numbers** (`seemannschaft_1_number`, `seemannschaft_2_number`), not by the derived `number`. Before its `(subject, number)` upsert, `sync_catalog()` moves existing Seemannschaft rows to their new key by official number:
  - an exact match keeps its row;
  - an un-merged pair's segeln half takes over the old merged row, including its id and progress;
  - the motor half gets a new row with a *copy* of that progress, so learners keep it in either exam variant;
  - a row whose official question no longer exists in that form is deleted, as ADR-0022 already does.
  
  `seemannschaft_allgemein` stays numbered 1..n without gaps.
- The split rows' topics were proposed by `manage_topics.py --missing` (classifies only questions with no assignment, leaves reviewed ones untouched) and reviewed by hand. The `topic_assignments/seemannschaft_allgemein.yaml` keys were remapped to the new numbering.

## Consequences

- Learners of either variant now see their own catalog's text wherever the content differs. Where only the editing differs, they may still see the other catalog's spelling, for example a Motor learner reading S I's "Akerplatz" typo or S I's correct "Steuerbordseite" instead of S II's "Stuerbordseite". That's a deliberate, documented trade-off per pair, not an oversight.
- `seemannschaft_allgemein` shrinks from 106 to 98 questions; `_segeln` grows from 57 to 65, `_motor` from 40 to 48. Each variant's total question count is unchanged.
- Renumbering is now safe. Any future edit to the duplicates list can shift `seemannschaft_allgemein` numbers without moving progress, because identity comes from official numbers that never change. Only `topic_assignments/seemannschaft_allgemein.yaml` is still keyed by `number` and must be remapped with such an edit. A missing assignment shows up as an unassigned question in `test_seed_catalog_end_to_end`.
- Known limitation: *merging* two previously separate rows keeps the segeln row's progress and drops the motor row's. That's acceptable while merges are rare and reviewed; revisit if one is ever needed with real learners on both rows.
- Rejected alternatives:
  - **Keep `seemannschaft_allgemein` numbers stable by leaving gaps.** This needs no identity logic, but learners would see "Nr. 24" jump to "Nr. 26" (`PracticePage` shows the number). A split pair's progress would still need special handling, and the next edit would have the same problem.
  - **Keep all pairs merged and store per-variant wording overrides on the merged row.** Faithful, but it needs a schema change and variant-aware serving for 8 questions. Un-merging reuses the existing variant-only subjects.
  - **Un-merge all 31.** Maximally literal, but it duplicates 23 questions whose only differences are typos and punctuation. A human judged those to be the same question.
