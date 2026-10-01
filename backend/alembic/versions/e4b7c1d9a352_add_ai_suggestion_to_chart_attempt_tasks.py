"""add the Lotsen-Check suggestion to chart_attempt_tasks

Revision ID: e4b7c1d9a352
Revises: d8b4f2e6a913
Create Date: 2026-10-02 10:00:00.000000

The suggestion of the Kartenaufgaben check (ADR-0058), stored with the answer it checked.
Nullable columns only, so the code that's still running during the deploy is unaffected.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4b7c1d9a352"
down_revision: str | None = "d8b4f2e6a913"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("chart_attempt_tasks", sa.Column("ai_points", sa.Integer(), nullable=True))
    op.add_column("chart_attempt_tasks", sa.Column("ai_feedback", sa.Text(), nullable=True))
    op.add_column("chart_attempt_tasks", sa.Column("ai_suspected_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("chart_attempt_tasks", "ai_suspected_error")
    op.drop_column("chart_attempt_tasks", "ai_feedback")
    op.drop_column("chart_attempt_tasks", "ai_points")
