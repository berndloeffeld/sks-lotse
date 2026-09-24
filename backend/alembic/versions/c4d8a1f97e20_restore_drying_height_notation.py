"""restore drying height notation in navigation 84

Revision ID: c4d8a1f97e20
Revises: f6881a08211c
Create Date: 2026-09-19 12:00:00.000000

The PDF flattens the chart symbol "2 with a small 3" (drying height 2,3 m) to
the plain text "2 3"; catalog_seed.QUESTION_TEXT_FIXES restores it in Unicode.
Upserts in place, so question ids and learner progress are unaffected.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "c4d8a1f97e20"
down_revision: str | None = "f6881a08211c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Superseded: e5b3a9c1d720 is the oldest migration that still syncs the catalog. Every sync
    # runs today's build_catalog(), not the one of its revision, so on a fresh database this one
    # would only write what e5b3a9c1d720 writes again. Databases past this revision (production)
    # already ran it.
    pass


def downgrade() -> None:
    # Nothing to restore: the old plain-digit text is a defect, not state worth keeping.
    pass
