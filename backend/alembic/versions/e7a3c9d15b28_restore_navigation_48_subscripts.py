"""restore the subscripts in the navigation 48 answer

Revision ID: e7a3c9d15b28
Revises: b5e2c8d41f97
Create Date: 2026-09-20 10:00:00.000000

The PDF text drops the subscripts of "O_k"/"O_b" and appends them after the
sentence; catalog_seed.ANSWER_TEXT_FIXES restores them. Upserts in place, so
question ids and learner progress are unaffected.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "e7a3c9d15b28"
down_revision: str | None = "b5e2c8d41f97"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Superseded: e5b3a9c1d720 is the oldest migration that still syncs the catalog. Every sync
    # runs today's build_catalog(), not the one of its revision, so on a fresh database this one
    # would only write what e5b3a9c1d720 writes again. Databases past this revision (production)
    # already ran it.
    pass


def downgrade() -> None:
    # Nothing to restore: the old scrambled text is a defect, not state worth keeping.
    pass
