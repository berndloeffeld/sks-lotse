"""fix question/answer split

Revision ID: b3e1c9a4d2f7
Revises: 675367b2d0b1
Create Date: 2026-09-19 10:00:00.000000

Re-syncs the question catalog after parse_catalog_pdf()
(app/services/catalog_seed.py) stopped guessing the question/answer boundary
from punctuation and started reading it off the PDF's typesetting instead
(questions bold, answers regular). The old heuristic put the whole official
answer into question_text for ~160 questions (a "." before the "?", e.g.
"z. B.", or a numbered answer after numbered sub-questions), and pushed a
trailing instruction such as "Nennen Sie mindestens 6 Beispiele." into
answer_text for ~30 more. Only the split point moves — the official wording
is unchanged.

sync_catalog() upserts by (subject, number), which this fix doesn't touch,
so question ids and every learner's progress survive (see ADR-0022). Calls
no external API; a pure data migration over already-committed fixtures.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "b3e1c9a4d2f7"
down_revision: str | None = "675367b2d0b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Superseded: e5b3a9c1d720 is the oldest migration that still syncs the catalog. Every sync
    # runs today's build_catalog(), not the one of its revision, so on a fresh database this one
    # would only write what e5b3a9c1d720 writes again. Databases past this revision (production)
    # already ran it.
    pass


def downgrade() -> None:
    # Nothing to restore: the old split was a parsing bug, not data worth
    # keeping. A downgrade all the way to base still works —
    # 16af6f481bf6's downgrade() unconditionally wipes questions/topics.
    pass
