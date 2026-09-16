"""add index on otp_codes expires_at

Revision ID: 692fd6f2ca42
Revises: 0bc9cd2fcf0a
Create Date: 2026-09-17 00:20:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "692fd6f2ca42"
down_revision: str | None = "0bc9cd2fcf0a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_otp_codes_expires_at", "otp_codes", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_otp_codes_expires_at", table_name="otp_codes")
