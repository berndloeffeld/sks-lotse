"""allow only one running exam per learner

Revision ID: a9f3e6b2d714
Revises: c4d81a6f2e93
Create Date: 2026-09-20 15:00:00.000000

Two parallel POST /exams could both pass the application-level check. A
partial unique index makes the database the arbiter.

Existing data is tidied first so the index can be built: attempts past their
deadline are submitted the way the app does it lazily (submitted_at =
deadline_at, timed_out), and if a learner still has several running ones, all
but the newest are submitted now.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9f3e6b2d714"
down_revision: str | None = "c4d81a6f2e93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE exam_attempts SET submitted_at = deadline_at, timed_out = true "
        "WHERE submitted_at IS NULL AND deadline_at <= now()"
    )
    op.execute(
        "UPDATE exam_attempts SET submitted_at = now() "
        "WHERE submitted_at IS NULL AND id NOT IN ("
        "SELECT MAX(id) FROM exam_attempts WHERE submitted_at IS NULL GROUP BY user_id)"
    )
    op.create_index(
        "uq_exam_attempts_one_in_progress_per_user",
        "exam_attempts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("submitted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_exam_attempts_one_in_progress_per_user", table_name="exam_attempts")
