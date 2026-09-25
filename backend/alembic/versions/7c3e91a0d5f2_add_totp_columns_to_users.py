"""add totp columns to users

Revision ID: 7c3e91a0d5f2
Revises: 512d9ec2f4b0
Create Date: 2026-09-25 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c3e91a0d5f2"
down_revision: str | None = "512d9ec2f4b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret_encrypted", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("totp_enabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("totp_last_counter", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "totp_last_counter")
    op.drop_column("users", "totp_enabled_at")
    op.drop_column("users", "totp_secret_encrypted")
