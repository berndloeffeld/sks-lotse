"""add ads_removed to users

Revision ID: f2a6c8d04b17
Revises: e5b3a9c1d720
Create Date: 2026-09-21 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f2a6c8d04b17"
down_revision: str | None = "e5b3a9c1d720"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    column = sa.Column("ads_removed", sa.Boolean(), server_default=sa.false(), nullable=False)
    op.add_column("users", column)


def downgrade() -> None:
    op.drop_column("users", "ads_removed")
