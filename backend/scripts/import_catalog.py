"""Sync the question catalog in the local DB with the committed source files.

Usage:
    PYTHONPATH=. .venv/bin/python scripts/import_catalog.py

Runs the full pipeline from app/services/catalog_seed.py — parse the PDF,
collapse Seemannschaft I/II via scripts/data/seemannschaft_duplicates.yaml,
attach topics from scripts/data/topic_assignments/ — and upserts the result.
The same code runs automatically as an Alembic data migration on every
`alembic upgrade head` (Render's startCommand, CI, local dev) — that's what
actually seeds production. This script is for iterating on the parser or
the reviewed YAML files locally without a full migration cycle.

Re-running is safe: questions are upserted by (subject, number), so ids and
learners' progress survive; only a question that disappeared from the
catalog is deleted (see ADR-0022).

Known limitations:
- Chart/diagram images referenced by ~6 questions are not extracted —
  image_ref is left null for all rows.
- The official answer to Seemannschaft I 79 / II 65 (seemannschaft_allgemein
  38) and Seemannschaft I 104 (seemannschaft_segeln 104) is only a sketch, so
  their answer_text is empty; the learning page says so instead.

Question and answer are told apart by typesetting (questions bold, answers
regular — see extract_marked_text), not by punctuation.
"""

from app.core.database import SessionLocal
from app.models.question import Question
from app.services.catalog_seed import seed_catalog


def main() -> None:
    db = SessionLocal()
    try:
        unassigned = seed_catalog(db)
        count = db.query(Question).count()
    finally:
        db.close()
    print(f"Catalog synced: {count} questions.")
    if unassigned:
        print(f"{len(unassigned)} questions have no topic assignment: {unassigned}")


if __name__ == "__main__":
    main()
