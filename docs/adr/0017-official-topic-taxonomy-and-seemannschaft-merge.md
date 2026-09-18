# 0017. Official topic taxonomy, LLM-assisted assignment only, and merging Seemannschaft I/II

Status: Accepted

## Context

The catalog was flat within each of the 5 ELWIS subjects — no sub-grouping beyond `(subject, number)` PDF order. That's fine for 101 questions, unwieldy for the eventual question-list/answering UI at 638.

Two options for where the sub-topic names come from:
1. Ask an LLM to invent a clustering from the question texts.
2. Use the official sub-topic list already published in the catalog itself — the table of contents on pages 1–3 of `docs/Fragenkatalog-SKS.pdf` (issued by the Bundesministerium für Verkehr, Bau und Stadtentwicklung together with the WSV, DMYV and DSV) names 5 Navigation, 4 Schifffahrtsrecht, 9 Wetterkunde and 18/16 Seemannschaft I/II topics — but never states which question belongs to which. Competitor apps (SKS-Buddy, the official SKS app) advertise "kleinere Themenbereiche" as a feature but don't publish their breakdown either.

Separately, comparing Seemannschaft I ("Antriebsmaschine und unter Segel", 163 questions) and Seemannschaft II ("Antriebsmaschine", 146 questions) question-by-question showed ~100 are word-for-word or near word-for-word identical (safety equipment, anchoring, MOB, ropework, boat care) — only rigging/sail-trim (I-only) and engine/boat-type content (II-only) really differ. Storing every shared question twice, once per subject, is pure redundancy that would also have to be independently topic-classified twice.

## Decision

- **Topic names are option 2: transcribed verbatim from the PDF's own table of contents** (`backend/scripts/data/topics.yaml`), never invented by an LLM or by us. The LLM's only job (`backend/scripts/manage_topics.py`) is classifying each question into one of these fixed names — never naming or renaming a category — and even that classification is a `propose` (LLM) → human review of a committed YAML file → `apply` step, not a live/runtime call. This mirrors `import_catalog.py`'s own "PDF is the source of truth, script is just re-runnable" philosophy instead of introducing a second, LLM-authored source of truth.
- **Seemannschaft I and II are merged into three subjects**: `seemannschaft_allgemein` (the ~100 shared questions, stored once), `seemannschaft_segeln` (I-only), `seemannschaft_motor` (II-only). Matching is plain text-similarity (`difflib`, no LLM — the duplicates are near word-for-word identical, so this is cheap and deterministic), again `propose` → human review → `apply` (`backend/scripts/merge_seemannschaft.py`). Both original per-variant question numbers are kept (`Question.seemannschaft_1_number` / `seemannschaft_2_number`, both set for a merged `seemannschaft_allgemein` row, one set for `_segeln`/`_motor`) so the amtliche numbering is never fully lost even though `Question.number` itself gets renumbered for the merged subject.
- **The exam variant (Motor vs. Segeln und Motor) becomes an explicit, chosen account attribute** (`User.exam_variant`, nullable), not just an implicit fact about which Seemannschaft subject a learner happens to look at. `app/core/exam_variant.py` maps each variant to its full subject set; `GET /questions`/`/questions/random` apply that as the default subject filter whenever the caller doesn't pass an explicit `subject`, which always wins.
- Both scripts run in a fixed pipeline order — `import_catalog.py` → `merge_seemannschaft.py apply` → `manage_topics.py apply` — because each later step is keyed on the subjects/numbers the previous one produces, and `import_catalog.py` recreates its raw output (including the now-intermediate `seemannschaft_1`/`seemannschaft_2` subjects) from scratch on every run.

## Consequences

- No topic-naming risk: every category a learner sees is one the exam authority itself published, not a paraphrase or an LLM's invention — important for a catalog whose entire value proposition is fidelity to the official exam.
- The topic classification (`manage_topics.py`) calls the Anthropic API (`ANTHROPIC_API_KEY`, a local dev-tooling-only credential — `anthropic` is now a `requirements.txt` dependency), deliberately separate from `OPENAI_API_KEY`, which stays reserved for the actual grading feature per CLAUDE.md's tech stack. Both this script and `merge_seemannschaft.py`'s duplicate matching are one-off/re-runnable dev scripts, not request-path code; the review-before-apply YAML files are committed, so `apply` never needs to hit an LLM again unless the catalog itself is re-imported.
- `Question.number` is no longer a direct pointer to "the Nth question in the official PDF" for the 3 Seemannschaft subjects the way it still is for Navigation/Schifffahrtsrecht/Wetterkunde — `seemannschaft_1_number`/`seemannschaft_2_number` carry that traceability instead. Anyone re-deriving the catalog must remember to run the full 3-script pipeline, not just `import_catalog.py`; documented in each script's own docstring and in CLAUDE.md → Question Catalog.
- Text-similarity duplicate matching is a greedy nearest-match, not a global optimum — one mismatched pair was caught and hand-corrected during review (`seemannschaft_1` #55 vs `seemannschaft_2` #46 instead of #45, which then displaced #58), which is exactly why `apply` only ever reads the reviewed file and never re-runs the matcher itself.
- `exam_variant` is the first per-account preference field on `User` — there is no settings UI to set it yet, only `PATCH /api/v1/auth/me`; a learner who hasn't chosen one yet (`NULL`) sees every subject, unchanged from today's behavior.

## Addendum (2026-09-18)

Right after this shipped, production's `topic` field was null on every question — `merge_seemannschaft.py apply`/`manage_topics.py apply` had only ever been run against a local dev database. Render's `startCommand` runs `alembic upgrade head` before every deploy (see [ADR-0005](0005-render-deployment-topology.md)), so the schema migration reached production automatically; the *data* didn't, because populating it was a separate manual script nobody had run there.

Fix: the shared logic behind all three `apply` steps moved into `backend/app/services/catalog_seed.py` (`seed_catalog()`), called from a new Alembic **data migration** rather than left as standalone scripts. `alembic upgrade head` — already run everywhere, including Render, on every deploy — now seeds/rebuilds the full catalog as a side effect of the same command that already runs the schema migrations. Consequences:

- `import_catalog`'s LLM-free, deterministic steps (PDF parsing, applying an already-reviewed duplicate/topic-assignment file) are safe to run unattended in a migration — they're pure functions of committed source files. The *proposing* half of the pipeline (LLM classification, text-similarity duplicate matching) stays CLI-only, since it needs a human to review the output before it's trustworthy; the CLI scripts are now thin wrappers around the same shared functions the migration calls.
- `anthropic` moved from `requirements.txt` to `requirements-dev.txt` — the running app (including the migration) never imports it, only `manage_topics.py propose` does.
- `app/services/catalog_seed.py` now carries real test coverage (`backend/tests/test_catalog_seed.py`) rather than being unmeasured script code, since it's genuinely production-serving logic now, not a one-off tool.
- A data migration that deletes and re-inserts `questions`/`topics` on every fresh `alembic upgrade head` is unusual for a migration, but appropriate here: the data is 100% reproducible from files already committed to the repo (the PDF, the reviewed YAML fixtures), and nothing else references `questions.id`/`topics.id` yet. If a future table gains a foreign key into either, this approach needs revisiting before that ships.
