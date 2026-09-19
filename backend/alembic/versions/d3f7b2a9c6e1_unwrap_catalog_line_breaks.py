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

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "d3f7b2a9c6e1"
down_revision: str | None = "a7c3e5f1b8d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Whitespace-only data change; not worth reconstructing the old breaks.
    pass
