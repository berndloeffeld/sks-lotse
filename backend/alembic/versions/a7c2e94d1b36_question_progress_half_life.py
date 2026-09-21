"""question_progress: replace correct_streak with a memory half-life

Revision ID: a7c2e94d1b36
Revises: f2a6c8d04b17
Create Date: 2026-09-21 12:00:00.000000

ADR-0034. Existing streaks are carried over as the half-life a run of that
length would have produced (FULL_GAIN ** streak, 0.25 days for a reset one),
dated from the row's last update — so a long-idle "gelernt" question is
already due again, as the new rule intends. Constants are frozen here on
purpose: the migration must keep meaning what it meant when it was written.
"""

import math
from collections.abc import Sequence
from datetime import timedelta

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c2e94d1b36"
down_revision: str | None = "f2a6c8d04b17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_FULL_GAIN = 2.5
_RESET_HALF_LIFE = 0.25
_RECALL_THRESHOLD = 0.7


def upgrade() -> None:
    op.add_column(
        "question_progress", sa.Column("half_life_days", sa.Float(), server_default="1", nullable=False)
    )
    op.add_column(
        "question_progress",
        sa.Column(
            "last_graded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
    )
    op.add_column(
        "question_progress",
        sa.Column(
            "review_due_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
    )

    bind = op.get_bind()
    progress = sa.table(
        "question_progress",
        sa.column("id", sa.Integer),
        sa.column("correct_streak", sa.Integer),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("half_life_days", sa.Float),
        sa.column("last_graded_at", sa.DateTime(timezone=True)),
        sa.column("review_due_at", sa.DateTime(timezone=True)),
    )
    for row_id, streak, updated_at in bind.execute(
        sa.select(progress.c.id, progress.c.correct_streak, progress.c.updated_at)
    ).all():
        half_life = min(_FULL_GAIN**streak, 365.0) if streak > 0 else _RESET_HALF_LIFE
        due = updated_at + timedelta(days=half_life * math.log2(1 / _RECALL_THRESHOLD))
        bind.execute(
            progress.update()
            .where(progress.c.id == row_id)
            .values(half_life_days=half_life, last_graded_at=updated_at, review_due_at=due)
        )

    op.drop_column("question_progress", "correct_streak")


def downgrade() -> None:
    op.add_column(
        "question_progress", sa.Column("correct_streak", sa.Integer(), server_default="0", nullable=False)
    )
    # Lossy by nature: the half-life maps back to the streak that would
    # produce it (log base FULL_GAIN, rounded); a reset question goes to 0.
    op.execute(
        "UPDATE question_progress SET correct_streak = "
        "CASE WHEN half_life_days > 1 THEN CAST(ROUND(LN(half_life_days) / LN(2.5)) AS INTEGER) ELSE 0 END"
    )
    op.drop_column("question_progress", "review_due_at")
    op.drop_column("question_progress", "last_graded_at")
    op.drop_column("question_progress", "half_life_days")
