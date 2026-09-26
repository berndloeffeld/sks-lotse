# Question catalog pipeline

How the official SKS catalog PDF becomes the `questions` and `topics` rows, and what to do when it changes. The reasoning is in [ADR-0017](adr/0017-official-topic-taxonomy-and-seemannschaft-merge.md), [ADR-0020](adr/0020-merge-sparse-topics-into-collective-groups.md), [ADR-0022](adr/0022-catalog-sync-by-upsert.md), [ADR-0026](adr/0026-merge-seemannschaft-only-on-matching-wording.md) and [ADR-0033](adr/0033-catalog-images-as-static-files.md).

## The catalog

- **Source**: the official SKS question catalog as PDF (`docs/Fragenkatalog-SKS.pdf`, questions + official model answers). It's an amtliches Werk (§ 5 UrhG): cite ELWIS as the source and never change the wording.
- **Exam variants** by propulsion type: **"Segeln und Motor"** (Navigation + Schifffahrtsrecht + Wetterkunde + Seemannschaft I) and **"Motor"** (… + Seemannschaft II). A learner sits one or the other, not both. `app/core/exam_variant.py` maps each variant to its subjects.
- **Subjects**: `navigation`, `schifffahrtsrecht`, `wetterkunde`, and the Seemannschaft split. Seemannschaft I and II are ~65% word-for-word identical (safety equipment, anchoring, MOB, ropework; only rigging/sail trim vs. engine/boat types really differ), so they become:
  - `seemannschaft_allgemein`: shared questions, stored once in the Seemannschaft I wording;
  - `seemannschaft_segeln`: I only;
  - `seemannschaft_motor`: II only.

  A pair is only merged if question and answer match word for word, or a human accepted the difference as purely editorial (ADR-0026).
- **Official numbers**: `Question.seemannschaft_1_number` / `seemannschaft_2_number` keep the amtliche "Nummer N" from each variant's own catalog after the merge renumbers `seemannschaft_allgemein`. Both are set for a merged row, exactly one for a `_segeln`/`_motor` row, and both are `NULL` for the other three subjects.
- **Topics**: every question can carry a `topic_id`. Topic *names* are transcribed verbatim from the catalog's own table of contents (PDF pages 1–3) into `backend/scripts/data/topics.yaml`. A script or an LLM never invents a name.
- **Images**: 23 charts and sketches in the PDF (light configurations, weather maps, mooring/manoeuvre sketches) live as PNGs in `frontend/public/catalog/`. The reviewed `backend/scripts/data/question_images.yaml` assigns each one to its question and to either the question or the official answer. `questions.question_images`/`answer_images` (JSON lists of `{src, width, height}`) carry them to the API, and `frontend/src/components/QuestionImages.tsx` shows them. For 3 questions the official answer is *only* a sketch: their `answer_text` is empty and the answer is an image. Navigation has no images.

## How it gets into the database

**The catalog seeds itself.** `backend/app/services/catalog_seed.py` (`seed_catalog()`) is the single source of truth for PDF → rows. It runs as Alembic **data migrations**, each calling `sync_catalog(op.get_bind(), build_catalog())`, so every `alembic upgrade head` populates the full catalog. That includes Render's pre-deploy step on every deploy, so nobody has to remember an import. The migrations call nothing but the database. Every sync builds *today's* catalog, not the one of its revision, so the ones older than `e5b3a9c1d720_add_question_images.py` are no-ops now: on a fresh database they would only write what that one writes again, and production had run them long before. Downgrading `16af6f481bf6` deletes all `questions`/`topics` rows.

**Syncing is an upsert, never delete + insert** (ADR-0022). `build_catalog()` computes the full target state in memory. `sync_catalog()` upserts it keyed on `(subject, number)` / `(subject, slug)`, so question ids — and every learner's `question_progress` — survive a re-sync. Only a question that vanished from the catalog is deleted. Seemannschaft rows are first moved to their new key by their *official* numbers, because `seemannschaft_allgemein`'s `number` is derived and shifts whenever the duplicates list changes. `sync_catalog()` writes through table definitions frozen in that module (the columns as of `e5b3a9c1d720`, the oldest migration that still syncs), never through the ORM models, so old data migrations keep working when models gain columns. Adding columns is free; renaming or dropping a frozen one needs the old migrations to get their own copy of the logic.

## The three stages

Only the proposing halves of stages 2 and 3 are run by hand, on a developer's machine.

1. **Parse**: `parse_catalog_pdf()` turns the PDF into raw questions (still `seemannschaft_1`/`seemannschaft_2` here).
   - `clean()` joins lines the PDF merely wrapped (the layout's line breaks aren't part of the text) and keeps only breaks before list items (`1.`, `a)`, `-`, `•`). The frontend renders the rest with `whitespace-pre-line`.
   - Chart symbols the PDF flattens to plain digits are restored via `QUESTION_TEXT_FIXES` (Navigation 84: drying height, underlined digit + subscript digit) and drawn as markup by `frontend/src/components/RichText.tsx`.
   - `ANSWER_TEXT_FIXES` (Navigation 48: the PDF drops the subscripts of O_k/O_b and appends `k b` after the sentence) writes them as `O_k`/`O_b`, which `RichText` renders as `<sub>`.
   - The PDF's page footer ("Stand: 01. Juli 2006 © Wasserstraßen- und Schifffahrtsverwaltung des Bundes") trails the last answer on a page in the extracted text; `PAGE_FOOTER_RE` drops it, so it never shows up in an answer.
   - Known parsing limitations are listed in `backend/scripts/import_catalog.py`'s docstring.
2. **Merge**: `backend/scripts/merge_seemannschaft.py` proposes duplicate pairs by plain text similarity (no LLM) into `scripts/data/seemannschaft_duplicates.yaml` for a human to review. `merge_seemannschaft()` then collapses the two Seemannschaft subjects into the three above. A pair that isn't word-for-word identical needs an `accepted_difference` rationale, or the merge refuses to run. `backend/scripts/diff_seemannschaft_pairs.py` prints a word diff of every such pair for review.
3. **Classify**: `backend/scripts/manage_topics.py` calls the Anthropic API (`ANTHROPIC_API_KEY`, a local dev-tooling-only key, separate from the app's `ANTHROPIC_GRADING_API_KEY`) to classify questions into the fixed names from `topics.yaml`. It writes `scripts/data/topic_assignments/<subject>.yaml` for a human to review. `--missing` classifies only questions without an assignment, e.g. after un-merging a pair. `assign_topics()` then applies the reviewed file.

Images follow the same pattern: `backend/scripts/extract_catalog_images.py` proposes, a human corrects `question_images.yaml`, and both it and the PNGs are committed.

## Changing the catalog

- The proposing scripts read the PDF directly; no database needed. `backend/scripts/import_catalog.py` syncs a local database with the committed files (the same code as the migrations) to check the result.
- Only the *review artifacts* (`seemannschaft_duplicates.yaml`, `topic_assignments/*.yaml`, `question_images.yaml` plus its PNGs) have to exist before `alembic upgrade head` can seed a new environment. They are committed, so that's already true everywhere.
- Re-running the proposing scripts (and re-reviewing) is only needed when the source PDF or the topic taxonomy changes. A new data migration calling `sync_catalog(op.get_bind(), build_catalog())` then ships the result.
