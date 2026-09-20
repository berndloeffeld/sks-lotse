"""add ai_grading_enabled to users

Revision ID: b7c1d5e93a42
Revises: d9a4e7c21b60
Create Date: 2026-09-20 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c1d5e93a42"
down_revision: str | None = "d9a4e7c21b60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    column = sa.Column("ai_grading_enabled", sa.Boolean(), server_default=sa.false(), nullable=False)
    op.add_column("users", column)


def downgrade() -> None:
    op.drop_column("users", "ai_grading_enabled")
