"""drop users.ads_removed and the Werbefrei price (ADR-0060: no advertising)

The code stopped reading both in the previous deploy, so the version still running while this
migrates doesn't need them. A downgrade restores the column with every account at false and
leaves the price unset (its code default applies).

Revision ID: c5e8a1f3b927
Revises: a7c3e9d15b42
Create Date: 2026-10-11 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c5e8a1f3b927"
down_revision: str | None = "a7c3e9d15b42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("users", "ads_removed")
    op.execute("DELETE FROM app_settings WHERE key = 'price_ads_removed_cents'")


def downgrade() -> None:
    column = sa.Column("ads_removed", sa.Boolean(), server_default=sa.false(), nullable=False)
    op.add_column("users", column)
