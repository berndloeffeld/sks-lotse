"""add otp_codes.link_hash for the login link in the code email (ADR-0064)

Nullable, so the previous version keeps working while this migrates: it doesn't know the column,
and the codes it issues simply carry no link.

Revision ID: e4c2a7b91f35
Revises: d3b7f1a96e20
Create Date: 2026-10-21 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4c2a7b91f35"
down_revision: str | None = "d3b7f1a96e20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("otp_codes", sa.Column("link_hash", sa.String(length=64), nullable=True))
    op.create_index("ix_otp_codes_link_hash", "otp_codes", ["link_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_otp_codes_link_hash", table_name="otp_codes")
    op.drop_column("otp_codes", "link_hash")
