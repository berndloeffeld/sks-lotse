"""drop the site columns of users and purchases

Revision ID: d5a8f3c1e927
Revises: c9e4a1d7f536
Create Date: 2026-11-02 12:00:00.000000

SBF Lotse is gone (ADR-0071): users.signup_site and purchases.site recorded which of the two sites
an account or a purchase came from. The code stopped mapping them one deploy earlier (#383), so the
version still serving while this runs no longer reads them. The downgrade restores the columns
empty, as b7d2e5a9c143 added them; what they held is not kept.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5a8f3c1e927"
down_revision: str | None = "c9e4a1d7f536"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("purchases", "site")
    op.drop_column("users", "signup_site")


def downgrade() -> None:
    op.add_column("users", sa.Column("signup_site", sa.String(length=8), nullable=True))
    op.add_column("purchases", sa.Column("site", sa.String(length=8), nullable=True))
