"""create question_grading_log table

Revision ID: c3e9a7f1b246
Revises: b8d1f3a5c702
Create Date: 2026-09-30 14:00:00.000000

One row per grading with the half-life it produced, for the admin's per-question history
(docs/adr/0051-...). Starts empty: gradings before this migration were never recorded.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3e9a7f1b246"
down_revision: str | None = "b8d1f3a5c702"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "question_grading_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("graded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("half_life_days", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_question_grading_log_question_id_graded_at", "question_grading_log", ["question_id", "graded_at"]
    )
    op.create_index("ix_question_grading_log_user_id", "question_grading_log", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_question_grading_log_user_id", table_name="question_grading_log")
    op.drop_index("ix_question_grading_log_question_id_graded_at", table_name="question_grading_log")
    op.drop_table("question_grading_log")
