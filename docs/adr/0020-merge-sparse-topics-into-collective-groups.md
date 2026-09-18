# 0020. Merge/split sparse topics into new collective names, sized 10-35 questions

Status: Accepted

## Context

[ADR-0017](0017-official-topic-taxonomy-and-seemannschaft-merge.md) transcribes topic names verbatim from the catalog PDF's own table of contents, on the reasoning that every category a learner sees should be one the exam authority itself published. That worked as a naming *source*, but the resulting 67 topic rows turned out badly sized for a per-topic learning UI:

- Many topics had far fewer than 10 questions — some had none at all. `seemannschaft_segeln`/`seemannschaft_motor` each carry the *full* official 16-18-topic TOC, but most of those questions turned out word-for-word identical across variants and were moved into the shared `seemannschaft_allgemein` subject (ADR-0017's Seemannschaft merge); what's left in `_segeln`/`_motor` is often a handful of variant-exclusive questions per topic, or none (e.g. `ankern`, `sicherheitsausruestung`, `seetuechtigkeit` in both `_segeln` and `_motor` — 0 questions each).
- A few topics were the opposite problem: `KVR` (46 questions), `Seekarten und weitere nautische Publikationen` (44), `SeeSchStrO` (38) are each a whole learning session's worth of material bundled under one heading.

A topic with 0-9 questions isn't a usable unit of progress tracking; a topic with 40+ questions defeats the point of sub-dividing the catalog at all. Target: every topic between 10 and 35 questions.

Two ways to get there:
1. Keep every topic 1:1 with a TOC heading, and only adjust by moving individual questions between topics that already exist (doesn't fix the too-small topics — several have zero content in the affected subject to begin with) or introducing a manual "don't show sub-10 topics" UI rule (leaves the underlying data unfixed, and still leaves the 3 oversized topics as one giant catch-all each).
2. Merge/split topics into new, short collective names that group 2+ official TOC headings (for undersized ones) or divide one heading along its own internal structure (for the 3 oversized ones).

## Decision

Went with option 2, which necessarily amends ADR-0017's verbatim-naming rule: **the new collective names are short labels we wrote, not TOC headings** (e.g. "Druckgebilde, Wolken & lokale Winde", "KVR – Ausweich- und Fahrregeln"). Everything else in ADR-0017 still holds — topic *classification* (which question belongs where) is still never invented by an LLM at runtime; it's a one-time, human-reviewed grouping decision captured directly in the committed fixtures.

- `backend/scripts/data/topics.yaml`: 67 rows → 25, each sized 10-35. Groupings mostly follow each subject's own `display_order` (itself verbatim TOC order) — adjacent headings merged together — except where a topic's official display position put it far from its best thematic fit (e.g. `Meteorologische Messinstrumente`, last in `wetterkunde`'s TOC, merged into `Allgemeine Begriffe` rather than its literal neighbour `Seegang`). The 3 oversized topics were split by their own internal structure: `Seekarten und weitere nautische Publikationen` along the "und" the name already contains; `KVR` into its Ausweich-/Fahrregeln-vs-Lichter/Signale halves (the regulation's own Teil B vs. Teile C/D structure); `SeeSchStrO` into general traffic/right-of-way rules vs. buoyage/signals/Revier-specific rules (Nord-Ostsee-Kanal). Splitting required reading each of the ~130 affected question texts (via `parse_catalog_pdf()`) to classify individually — merges didn't, since they only regroup topics whose questions were already correctly assigned.
- `backend/scripts/data/topic_assignments/*.yaml`: every question number re-pointed from its old slug to the new merged/split slug.
- `app/services/catalog_seed.py`'s `apply_topics()` now also **deletes any Topic row whose `(subject, slug)` no longer appears in `topics.yaml`** — previously it only ever upserted, so a removed TOC entry would have left an orphaned, unreferenced row behind forever. Safe because every question referencing a merged-away topic is repointed to its new slug in the same pass, before the cleanup runs.
- New Alembic migration (`5499671351cd_merge_sparse_topics.py`) re-runs `apply_topics()` against an already-seeded database, the same pattern ADR-0017's addendum established for `seed_catalog()` — every environment picks up the new taxonomy on its next `alembic upgrade head`, no manual script run required.

## Consequences

- Every topic a learner sees now holds a usable amount of material (10-35 questions) — was the actual product motivation (ToDo: "Topics should have at least 10 questions").
- The verbatim-naming guarantee from ADR-0017 is narrowed: it still holds for topics that map 1:1 to a TOC heading, but a merged/split topic's *name* is now something we wrote, not something the exam authority published. `topics.yaml`'s header comment documents this explicitly so a future reader doesn't assume every name traces back to the PDF.
- `apply_topics()` deleting stale rows makes future taxonomy edits (further re-merging, renaming) safe to ship as a normal `topics.yaml` change + migration, without hand-written cleanup SQL each time.
- The split-topic groupings (KVR, SeeSchStrO, Seekarten/Publikationen) are a one-time manual read-and-classify pass, not derived from a reviewable propose/apply script step the way ADR-0017's original topic assignment was (that classification came from `manage_topics.py`'s LLM-assisted `propose` → human review). If the catalog PDF is ever re-imported and these three topics need re-splitting, that classification will need to be redone by hand again (or a small `propose`-style helper written for it) — it isn't automatically re-derivable from committed data the way the rest of the pipeline is.
