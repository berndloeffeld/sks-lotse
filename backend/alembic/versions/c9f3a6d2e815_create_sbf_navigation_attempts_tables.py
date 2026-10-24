"""create sbf_navigation_attempts and sbf_navigation_attempt_subtasks tables

Revision ID: c9f3a6d2e815
Revises: b7d2e5a9c143
Create Date: 2026-10-24 18:00:00.000000

The learners' saved runs through the SBF Navigationsaufgaben See, with the Lotsen-Check's suggestion
per subtask (ADR-0071). The tasks themselves are not tables — they're read from the committed
app/data/sbf_navigation.yaml. New tables only: the running code doesn't know them.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9f3a6d2e815"
down_revision: str | None = "b7d2e5a9c143"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sbf_navigation_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("task_number", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sbf_navigation_attempts_user_id_started_at", "sbf_navigation_attempts", ["user_id", "started_at"]
    )
    op.create_index(
        "uq_sbf_navigation_attempts_one_open_per_user_task",
        "sbf_navigation_attempts",
        ["user_id", "task_number"],
        unique=True,
        postgresql_where=sa.text("completed_at IS NULL"),
    )
    op.create_table(
        "sbf_navigation_attempt_subtasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("subtask_number", sa.Integer(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("point", sa.Integer(), nullable=True),
        sa.Column("ai_correct", sa.Boolean(), nullable=True),
        sa.Column("ai_feedback", sa.Text(), nullable=True),
        sa.Column("ai_suspected_error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["sbf_navigation_attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "attempt_id",
            "subtask_number",
            name="uq_sbf_navigation_subtasks_attempt_subtask",
        ),
    )


def downgrade() -> None:
    op.drop_table("sbf_navigation_attempt_subtasks")
    op.drop_index("uq_sbf_navigation_attempts_one_open_per_user_task", table_name="sbf_navigation_attempts")
    op.drop_index("ix_sbf_navigation_attempts_user_id_started_at", table_name="sbf_navigation_attempts")
    op.drop_table("sbf_navigation_attempts")
