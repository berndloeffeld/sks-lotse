"""index question_reports.user_id

Revision ID: c1d4e7a2b9f3
Revises: b3f7a1c9d264
Create Date: 2026-09-23

Postgres doesn't index foreign-key columns by itself. Account deletion and the DSGVO export look an
account's reports up by user_id, which was a sequential scan of the whole table.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c1d4e7a2b9f3"
down_revision: str | None = "b3f7a1c9d264"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_question_reports_user_id", "question_reports", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_question_reports_user_id", table_name="question_reports")
