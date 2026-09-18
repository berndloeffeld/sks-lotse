# 0022. Sync the question catalog by upsert, through frozen table definitions

Status: Accepted

## Context

The catalog (`questions`/`topics`) is seeded by Alembic data migrations that call `app/services/catalog_seed.py`, so every `alembic upgrade head` — including Render's before every deploy — brings the catalog along with the schema (see CLAUDE.md → Question Catalog). The first version of that module had two latent problems, neither visible yet because nothing has changed the catalog since learners started accumulating progress:

1. **It replaced the catalog by delete + insert.** `import_catalog()` ran `DELETE FROM questions` and inserted a fresh parse. `question_progress.question_id` has `ON DELETE CASCADE`, so re-seeding a database with learners in it — exactly what a future migration for an updated PDF or reviewed YAML file would do — would silently wipe every learner's progress and give every question a new id.
2. **It wrote through the ORM models.** The data migrations used `Question`/`Topic`, which always describe the schema at *head*. A migration runs against the schema of *its own* revision. As soon as a later migration adds a column to `questions` or `topics`, the old seed migration would include that not-yet-existing column in its INSERT, and every fresh `alembic upgrade head` (CI's `migrations` job, a new environment) would fail.

The pipeline also staged its intermediate results in the DB (raw `seemannschaft_1`/`seemannschaft_2` rows, then the merge, then topics), which is what forced delete + insert in the first place: the rows' subjects and numbers change between stages.

## Decision

- `build_catalog()` computes the complete target state **in memory**: parse the PDF, collapse Seemannschaft I/II using the reviewed duplicate list, attach the reviewed topic slugs. No DB involved.
- `sync_catalog(connection, questions)` makes the DB match it **by upsert**: topics keyed on `(subject, slug)`, questions keyed on `(subject, number)` — both already unique constraints. Existing rows are updated in place and keep their ids; only a question that disappeared from the target state is deleted (its progress with it, which is correct — the question no longer exists). Stale topics are deleted after questions stop pointing at them.
- `sync_catalog()` uses Core statements over **table definitions frozen in the module** (the columns as of the first data migration), never the ORM models. It runs on whatever connection it's given, so the migrations pass `op.get_bind()` and stay inside Alembic's transaction.
- The `propose` scripts (`merge_seemannschaft.py`, `manage_topics.py`) read the parsed PDF directly instead of intermediate DB rows; `import_catalog.py` is the one local command that syncs the DB.

## Consequences

- Re-running the seed is idempotent and safe on a database with learners in it; a future catalog change can ship as a new data migration calling `sync_catalog()` again. Verified against a Postgres DB seeded by the previous code: the new sync changes nothing (same ids, texts, topics).
- Upsert keys on `(subject, number)`. If a catalog update *renumbers* questions (e.g. a changed duplicate list shifting `seemannschaft_allgemein`'s sequential numbers), progress stays attached to the number, not the content. Acceptable for an official catalog whose numbers are stable; a content-based key would be more robust but has no natural candidate (texts get corrected).
- The frozen columns are a contract with the existing data migrations: adding columns to the models later is free, but renaming or dropping one of the frozen columns means those older migrations need their own copy of the sync logic. The module docstring says so.
- Row-by-row updates (~530) instead of one bulk insert — irrelevant at migration time.
- Rejected: a guard that refuses to re-seed once `question_progress` has rows. It would prevent the data loss, but also make every future catalog update impossible without hand-written SQL.
