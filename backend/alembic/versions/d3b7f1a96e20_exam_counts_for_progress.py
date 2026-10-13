"""add users.exam_counts_for_progress and exam_attempts.counts_for_progress (ADR-0061)

Both default to true, so every account and every exam already on record counts for the Lernstand
from now on, with all three grades. The previous version keeps working while this migrates: it
doesn't know the columns, and the server default fills them for the rows it inserts.

Revision ID: d3b7f1a96e20
Revises: c5e8a1f3b927
Create Date: 2026-10-13 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3b7f1a96e20"
down_revision: str | None = "c5e8a1f3b927"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    column = sa.Column("exam_counts_for_progress", sa.Boolean(), server_default=sa.true(), nullable=False)
    op.add_column("users", column)
    column = sa.Column("counts_for_progress", sa.Boolean(), server_default=sa.true(), nullable=False)
    op.add_column("exam_attempts", column)


def downgrade() -> None:
    op.drop_column("exam_attempts", "counts_for_progress")
    op.drop_column("users", "exam_counts_for_progress")
