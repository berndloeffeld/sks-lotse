"""add blocked_emails table

Revision ID: 512d9ec2f4b0
Revises: deb5a1d76210
Create Date: 2026-09-24 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "512d9ec2f4b0"
down_revision: str | None = "deb5a1d76210"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "blocked_emails",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_blocked_emails_kind_value", "blocked_emails", ["kind", "value"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_blocked_emails_kind_value", table_name="blocked_emails")
    op.drop_table("blocked_emails")
