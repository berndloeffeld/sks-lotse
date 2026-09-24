"""drop weekly AI-check budget columns (ADR-0044: tokens are the sole spending control)

Revision ID: deb5a1d76210
Revises: 1f2fe299ee32
Create Date: 2026-09-24 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "deb5a1d76210"
down_revision: str | None = "1f2fe299ee32"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("users", "ai_checks_weekly_limit")
    op.drop_column("users", "ai_checks_used")
    op.drop_column("users", "ai_checks_week")


def downgrade() -> None:
    op.add_column("users", sa.Column("ai_checks_week", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("ai_checks_used", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("ai_checks_weekly_limit", sa.Integer(), nullable=True))
