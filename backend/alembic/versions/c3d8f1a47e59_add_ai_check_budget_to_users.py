"""add ai_checks_day and ai_checks_used to users

Revision ID: c3d8f1a47e59
Revises: b7c1d5e93a42
Create Date: 2026-09-20 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d8f1a47e59"
down_revision: str | None = "b7c1d5e93a42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("ai_checks_day", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("ai_checks_used", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "ai_checks_used")
    op.drop_column("users", "ai_checks_day")
