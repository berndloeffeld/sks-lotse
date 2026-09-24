"""unwrap catalog line breaks

Revision ID: d3f7b2a9c6e1
Revises: a7c3e5f1b8d2
Create Date: 2026-09-19 10:00:00.000000

The PDF parser used to keep every line break of the catalog's page layout, so
questions and answers showed a break in the middle of a sentence (e.g.
Navigation 72). `clean()` now joins wrapped lines and keeps only the breaks
before list items; this re-syncs the catalog. Wording is unchanged, only
whitespace. sync_catalog() upserts, so question ids (and progress) survive.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "d3f7b2a9c6e1"
down_revision: str | None = "a7c3e5f1b8d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Superseded: e5b3a9c1d720 is the oldest migration that still syncs the catalog. Every sync
    # runs today's build_catalog(), not the one of its revision, so on a fresh database this one
    # would only write what e5b3a9c1d720 writes again. Databases past this revision (production)
    # already ran it.
    pass


def downgrade() -> None:
    # Whitespace-only data change; not worth reconstructing the old breaks.
    pass
