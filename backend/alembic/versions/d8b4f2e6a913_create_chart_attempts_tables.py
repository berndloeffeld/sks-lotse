"""create chart_attempts and chart_attempt_tasks tables

Revision ID: d8b4f2e6a913
Revises: c3e9a7f1b246
Create Date: 2026-09-30 19:00:00.000000

The learners' runs through the Kartenaufgaben (ADR-0052). The exercises themselves
are not tables — they're read from the committed app/data/chart_exercises.yaml.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8b4f2e6a913"
down_revision: str | None = "c3e9a7f1b246"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chart_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("exercise_number", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chart_attempts_user_id_started_at", "chart_attempts", ["user_id", "started_at"])
    op.create_index(
        "uq_chart_attempts_one_open_per_user_exercise",
        "chart_attempts",
        ["user_id", "exercise_number"],
        unique=True,
        postgresql_where=sa.text("completed_at IS NULL"),
    )
    op.create_table(
        "chart_attempt_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("task_number", sa.Integer(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("points_awarded", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["chart_attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "attempt_id", "task_number", name="uq_chart_attempt_tasks_attempt_id_task_number"
        ),
    )


def downgrade() -> None:
    op.drop_table("chart_attempt_tasks")
    op.drop_index("uq_chart_attempts_one_open_per_user_exercise", table_name="chart_attempts")
    op.drop_index("ix_chart_attempts_user_id_started_at", table_name="chart_attempts")
    op.drop_table("chart_attempts")
