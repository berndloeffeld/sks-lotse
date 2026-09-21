"""question_progress: add last_correct_at for the Fokus session order

Revision ID: c4d81f6a2e95
Revises: a7c2e94d1b36
Create Date: 2026-09-22 12:00:00.000000

The Fokus session (ADR-0028) asks the question with the oldest correct answer
first. Only last_graded_at existed, so existing rows are backfilled with it
wherever the half-life shows the question was answered "Richtig" at least once
(half-life above the initial 1 day). That is an approximation — the last
grading may have been a later "Falsch" — and only affects the order.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d81f6a2e95"
down_revision: str | None = "a7c2e94d1b36"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "question_progress", sa.Column("last_correct_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute("UPDATE question_progress SET last_correct_at = last_graded_at WHERE half_life_days > 1")


def downgrade() -> None:
    op.drop_column("question_progress", "last_correct_at")
