"""add topics, question topic/seemannschaft numbers, user exam variant

Revision ID: 7d518ffd1fbd
Revises: 692fd6f2ca42
Create Date: 2026-09-17 17:26:10.713541

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7d518ffd1fbd"
down_revision: str | None = "692fd6f2ca42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("subject", sa.String(length=64), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subject", "slug", name="uq_topic_subject_slug"),
    )
    op.add_column("questions", sa.Column("topic_id", sa.Integer(), nullable=True))
    op.add_column("questions", sa.Column("seemannschaft_1_number", sa.Integer(), nullable=True))
    op.add_column("questions", sa.Column("seemannschaft_2_number", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_questions_topic_id", "questions", "topics", ["topic_id"], ["id"], ondelete="SET NULL"
    )
    op.add_column("users", sa.Column("exam_variant", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "exam_variant")
    op.drop_constraint("fk_questions_topic_id", "questions", type_="foreignkey")
    op.drop_column("questions", "seemannschaft_2_number")
    op.drop_column("questions", "seemannschaft_1_number")
    op.drop_column("questions", "topic_id")
    op.drop_table("topics")
