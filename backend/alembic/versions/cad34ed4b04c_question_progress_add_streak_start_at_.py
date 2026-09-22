"""question_progress: add streak_start_at for cumulative spacing

Revision ID: cad34ed4b04c
Revises: d4e9a2b8c351
Create Date: 2026-09-22 16:21:42.637373

docs/adr/0039-cumulative-spacing-for-richtig-streaks.md: a "Richtig" inside an
unbroken streak now measures spacing against the streak's first "Richtig"
instead of only the previous grading. No backfill: existing rows start with
no known streak (NULL), which is the safe default — the next "Richtig" simply
falls back to the old single-step spacing, same as a genuinely new streak.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cad34ed4b04c"
down_revision: str | None = "d4e9a2b8c351"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "question_progress", sa.Column("streak_start_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("question_progress", "streak_start_at")
