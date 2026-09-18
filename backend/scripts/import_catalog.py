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

Known limitation: chart/diagram images referenced by ~6 questions are not
extracted — image_ref is left null for all rows.
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
