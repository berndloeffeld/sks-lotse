"""restore drying height notation in navigation 84

Revision ID: c4d8a1f97e20
Revises: f6881a08211c
Create Date: 2026-09-19 12:00:00.000000

The PDF flattens the chart symbol "2 with a small 3" (drying height 2,3 m) to
the plain text "2 3"; catalog_seed.QUESTION_TEXT_FIXES restores it in Unicode.
Upserts in place, so question ids and learner progress are unaffected.
"""

from collections.abc import Sequence

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "c4d8a1f97e20"
down_revision: str | None = "f6881a08211c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Nothing to restore: the old plain-digit text is a defect, not state worth keeping.
    pass
