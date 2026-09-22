"""add ai_flags_count/ai_flags_last_at to users

Revision ID: b3f7a1c9d264
Revises: cad34ed4b04c
Create Date: 2026-09-22 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3f7a1c9d264"
down_revision: str | None = "cad34ed4b04c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("ai_flags_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("ai_flags_last_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "ai_flags_last_at")
    op.drop_column("users", "ai_flags_count")
