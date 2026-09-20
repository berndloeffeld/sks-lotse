"""restore the subscripts in the navigation 48 answer

Revision ID: e7a3c9d15b28
Revises: b5e2c8d41f97
Create Date: 2026-09-20 10:00:00.000000

The PDF text drops the subscripts of "O_k"/"O_b" and appends them after the
sentence; catalog_seed.ANSWER_TEXT_FIXES restores them. Upserts in place, so
question ids and learner progress are unaffected.
"""

from collections.abc import Sequence

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "e7a3c9d15b28"
down_revision: str | None = "b5e2c8d41f97"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Nothing to restore: the old scrambled text is a defect, not state worth keeping.
    pass
