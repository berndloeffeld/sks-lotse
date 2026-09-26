"""strip the PDF page footer from the official answers

Revision ID: a4c7e2b9d613
Revises: 9d4b2f6a8e13
Create Date: 2026-09-26 10:00:00.000000

Four answers (five rows before the Seemannschaft merge) ended in the catalog's page footer "Stand:
01. Juli 2006 © Wasserstraßen- und Schifffahrtsverwaltung des Bundes"; catalog_seed.PAGE_FOOTER_RE
drops it now. Upserts in place, so question ids and learner progress are unaffected.
"""

from collections.abc import Sequence

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "a4c7e2b9d613"
down_revision: str | None = "9d4b2f6a8e13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Nothing to restore: the footer is a parsing defect, not state worth keeping.
    pass
