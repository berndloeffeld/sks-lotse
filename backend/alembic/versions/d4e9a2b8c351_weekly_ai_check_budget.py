"""weekly AI-check budget: ai_checks_week, per-user limit, app_settings

Revision ID: d4e9a2b8c351
Revises: c4d81f6a2e95
Create Date: 2026-09-21 17:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e9a2b8c351"
down_revision: str | None = "c4d81f6a2e95"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The old value is a day, not a Monday: it never equals the current week, so every counter starts fresh.
    op.alter_column("users", "ai_checks_day", new_column_name="ai_checks_week")
    op.add_column("users", sa.Column("ai_checks_weekly_limit", sa.Integer(), nullable=True))
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_column("users", "ai_checks_weekly_limit")
    op.alter_column("users", "ai_checks_week", new_column_name="ai_checks_day")
