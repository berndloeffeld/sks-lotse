"""add lotse_check_log and the indexes the daily KPI report reads

Revision ID: a7c3e9d15b42
Revises: e4b7c1d9a352
Create Date: 2026-10-05 12:00:00.000000

A new table (nothing running reads it) and two indexes (the report filters question_progress by
updated_at and question_grading_log by graded_at; the cron runs with a 15 s statement timeout).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c3e9d15b42"
down_revision: str | None = "e4b7c1d9a352"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lotse_check_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("tokens", sa.Integer(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lotse_check_log_checked_at", "lotse_check_log", ["checked_at"], unique=False)
    op.create_index("ix_question_progress_updated_at", "question_progress", ["updated_at"], unique=False)
    op.create_index("ix_question_grading_log_graded_at", "question_grading_log", ["graded_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_question_grading_log_graded_at", table_name="question_grading_log")
    op.drop_index("ix_question_progress_updated_at", table_name="question_progress")
    op.drop_index("ix_lotse_check_log_checked_at", table_name="lotse_check_log")
    op.drop_table("lotse_check_log")
