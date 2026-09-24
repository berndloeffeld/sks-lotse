"""un-merge Seemannschaft pairs whose wording differs

Revision ID: f6881a08211c
Revises: b3e1c9a4d2f7
Create Date: 2026-09-19 14:00:00.000000

Re-syncs the question catalog after 8 Seemannschaft I/II pairs were taken out
of scripts/data/seemannschaft_duplicates.yaml: their question or answer
content differs between the two official catalogs (e.g. S I #55 / S II #45,
3 vs. 5 fueling measures), so a merged row showed Motor learners wording
that isn't theirs. Each now becomes a seemannschaft_segeln and a
seemannschaft_motor row with its own official text. See ADR-0026.

That shrinks seemannschaft_allgemein from 106 to 98 rows and renumbers the
rest. sync_catalog() first moves existing Seemannschaft rows to their new
(subject, number) by their official catalog numbers, so every learner's
progress stays on the question it belongs to: an un-merged pair's segeln
half keeps the old row (id and progress), its motor half gets a copy of that
progress. Calls no external API; a pure data migration over
already-committed fixtures.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "f6881a08211c"
down_revision: str | None = "b3e1c9a4d2f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Superseded: e5b3a9c1d720 is the oldest migration that still syncs the catalog. Every sync
    # runs today's build_catalog(), not the one of its revision, so on a fresh database this one
    # would only write what e5b3a9c1d720 writes again. Databases past this revision (production)
    # already ran it.
    pass


def downgrade() -> None:
    # Nothing to restore: re-merging would need the old duplicates file,
    # and the merged rows were the inaccurate state. A downgrade all the way
    # to base still works — 16af6f481bf6's downgrade() unconditionally wipes
    # questions/topics.
    pass
