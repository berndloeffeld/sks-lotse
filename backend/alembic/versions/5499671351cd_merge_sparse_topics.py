"""merge sparse topics

Revision ID: 5499671351cd
Revises: 90df5aade4fe
Create Date: 2026-09-18 15:45:53.882472

Re-applies the topic taxonomy from the (now updated) backend/scripts/data/topics.yaml
and topic_assignments/*.yaml onto an already-seeded database. Several official
catalog topics had far fewer than 10 questions (some had none at all, in
seemannschaft_segeln/_motor), making them unusable as a learning-progress unit;
others had far more than a single learning session's worth. Both are merged/split
into new, short collective topic names so every topic ends up with 10-35
questions — see ADR-0020 for the rationale and the full before/after mapping.

sync_catalog() (app/services/catalog_seed.py) upserts Topic rows by (subject,
slug), repoints every Question.topic_id from the updated assignments files, and
deletes any Topic row whose (subject, slug) no longer appears in topics.yaml —
cleaning up the old, now-merged-away rows. Question rows themselves are upserted
in place, so their ids (and any progress pointing at them) are unaffected. Calls
no external API; this is a pure data migration over already-committed fixtures.
"""

from collections.abc import Sequence

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "5499671351cd"
down_revision: str | None = "90df5aade4fe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Not meaningfully reversible in place: the old (pre-merge) per-topic
    # question assignments aren't retained anywhere once the merged-away
    # Topic rows are deleted. A downgrade all the way to base still works —
    # 16af6f481bf6's downgrade() unconditionally wipes questions/topics.
    pass
