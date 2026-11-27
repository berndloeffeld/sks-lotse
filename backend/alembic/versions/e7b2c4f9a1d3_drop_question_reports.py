"""drop question_reports

Revision ID: e7b2c4f9a1d3
Revises: d5a8f3c1e927
Create Date: 2026-11-27 12:00:00.000000

"Frage melden" is gone (ADR-0030 addendum 2026-11-27). The code stopped mapping question_reports
one deploy earlier (#414), so the version still serving while this runs no longer reads it. The
downgrade restores the table empty, as d9a4e7c21b60 and c1d4e7a2b9f3 created it; the reports it
held are not kept.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e7b2c4f9a1d3"
down_revision: str | None = "d5a8f3c1e927"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("question_reports")


def downgrade() -> None:
    op.create_table(
        "question_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_question_reports_question_id", "question_reports", ["question_id"])
    op.create_index("ix_question_reports_user_id", "question_reports", ["user_id"])
