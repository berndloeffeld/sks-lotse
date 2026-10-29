"""name the two light diagrams in the Schifffahrtsrecht 23 question

Revision ID: c9e4a1d7f536
Revises: b7d2e5a9c143
Create Date: 2026-10-29 12:00:00.000000

The two diagrams stood inline in the PDF ("von [Bild] in [Bild]") and are missing from its text.
catalog_seed.QUESTION_TEXT_FIXES now makes the sentence "von Bild 1 in Bild 2"; the images are
numbered to match. Upserts in place, so question ids and learner progress are unaffected.
"""

from collections.abc import Sequence

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "c9e4a1d7f536"
down_revision: str | None = "b7d2e5a9c143"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Nothing to restore: the old sentence with the missing words is a defect, not state worth keeping.
    pass
