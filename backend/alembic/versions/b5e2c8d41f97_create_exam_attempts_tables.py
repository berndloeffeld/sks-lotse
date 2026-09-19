"""create exam_attempts and exam_attempt_questions tables

Revision ID: b5e2c8d41f97
Revises: d3f7b2a9c6e1
Create Date: 2026-09-19 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5e2c8d41f97"
down_revision: str | None = "d3f7b2a9c6e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exam_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("exam_variant", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timed_out", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exam_attempts_user_id_started_at", "exam_attempts", ["user_id", "started_at"])
    op.create_table(
        "exam_attempt_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("subject_group", sa.String(length=32), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("outcome", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["exam_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id", "position", name="uq_exam_attempt_questions_attempt_id_position"),
    )


def downgrade() -> None:
    op.drop_table("exam_attempt_questions")
    op.drop_index("ix_exam_attempts_user_id_started_at", table_name="exam_attempts")
    op.drop_table("exam_attempts")
