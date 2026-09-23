"""add agb acceptance to users

Revision ID: b7f2a4d91c60
Revises: c1d4e7a2b9f3
Create Date: 2026-09-23 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7f2a4d91c60"
down_revision: str | None = "c1d4e7a2b9f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("agb_accepted_version", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("agb_accepted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "agb_accepted_at")
    op.drop_column("users", "agb_accepted_version")
