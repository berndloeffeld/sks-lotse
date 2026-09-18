"""add purpose to otp_codes

Revision ID: 361b6e8a6ef4
Revises: f8fa2fc743da
Create Date: 2026-09-18 22:46:16.909630

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "361b6e8a6ef4"
down_revision: str | None = "f8fa2fc743da"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing rows get "login" via a temporary server default — they're
    # short-lived (otp_ttl_minutes) and can't be told apart after the fact, so
    # at worst a pending email-change code stops working and has to be
    # re-requested. The default is dropped again right away: the model has
    # none, so every new insert must name its purpose explicitly.
    op.add_column(
        "otp_codes",
        sa.Column("purpose", sa.String(length=16), nullable=False, server_default="login"),
    )
    op.alter_column("otp_codes", "purpose", server_default=None)


def downgrade() -> None:
    op.drop_column("otp_codes", "purpose")
