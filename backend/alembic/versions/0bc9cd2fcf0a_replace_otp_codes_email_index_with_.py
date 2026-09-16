"""replace otp_codes email index with composite email created_at index

Revision ID: 0bc9cd2fcf0a
Revises: 703803d66760
Create Date: 2026-09-17 00:04:30.350549

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0bc9cd2fcf0a"
down_revision: str | None = "f25ff8b2868f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_otp_codes_email"), table_name="otp_codes")
    op.create_index("ix_otp_codes_email_created_at", "otp_codes", ["email", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_otp_codes_email_created_at", table_name="otp_codes")
    op.create_index(op.f("ix_otp_codes_email"), "otp_codes", ["email"], unique=False)
