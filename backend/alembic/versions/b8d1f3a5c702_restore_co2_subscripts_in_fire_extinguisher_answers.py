"""restore the CO2 subscripts in the fire extinguisher answers

Revision ID: b8d1f3a5c702
Revises: a4c7e2b9d613
Create Date: 2026-09-30 10:00:00.000000

The PDF text scrambles the subscript of "CO2" in Seemannschaft I 120/121 and II 101/102 (doubled,
detached or displaced behind the clause); catalog_seed.ANSWER_TEXT_FIXES restores it. Upserts in
place, so question ids and learner progress are unaffected.
"""

from collections.abc import Sequence

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "b8d1f3a5c702"
down_revision: str | None = "a4c7e2b9d613"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Nothing to restore: the scrambled text is a parsing defect, not state worth keeping.
    pass
