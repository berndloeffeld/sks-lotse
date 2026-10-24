"""add the site to users and purchases

Revision ID: b7d2e5a9c143
Revises: a4c9e2f7b1d3
Create Date: 2026-10-24 12:00:00.000000

One backend serves SKS Lotse and SBF Lotse (ADR-0070). users.signup_site records which site an
account was created on, purchases.site which site a Stripe purchase was made on — both for the
daily report's numbers per site. Nullable and without a default: the running code doesn't know the
columns, and older rows have no site to record.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d2e5a9c143"
down_revision: str | None = "a4c9e2f7b1d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("signup_site", sa.String(length=8), nullable=True))
    op.add_column("purchases", sa.Column("site", sa.String(length=8), nullable=True))


def downgrade() -> None:
    op.drop_column("purchases", "site")
    op.drop_column("users", "signup_site")
