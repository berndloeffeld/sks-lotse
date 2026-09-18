"""One-off import of the official SKS question catalog PDF into the questions table.

Usage:
    PYTHONPATH=. .venv/bin/python scripts/import_catalog.py

The parsing/import logic lives in app/services/catalog_seed.py, which also
runs automatically as an Alembic data migration on every `alembic upgrade
head` (Render's startCommand, CI, local dev) — that's what actually seeds
production. This script remains useful for iterating on the parser locally
without a full migration cycle.

Re-running is safe: it replaces the full contents of the questions table —
but that also means merge_seemannschaft.py and manage_topics.py (see those
scripts) must be re-run afterwards, since both are keyed on the subjects and
numbers this script produces and this script doesn't know about either.

Known limitation: a handful of questions that ask two things in one
sentence without numbering them ("Was ist X? Wovon hängt sie ab?") get
split at the first "?", so the second part ends up prefixed onto the
answer. Numbered multi-part questions ("1. ...? 2. ...?") are handled
correctly. Chart/diagram images referenced by ~6 questions are not
extracted — image_ref is left null for all rows.
"""

from app.core.database import SessionLocal
from app.services.catalog_seed import import_catalog


def main() -> None:
    db = SessionLocal()
    try:
        count = import_catalog(db)
    finally:
        db.close()
    print(f"Imported {count} questions.")


if __name__ == "__main__":
    main()
