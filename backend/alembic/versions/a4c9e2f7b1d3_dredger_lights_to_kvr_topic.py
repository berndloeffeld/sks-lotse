"""move Schifffahrtsrecht 77 and 78 to the KVR lights topic

Revision ID: a4c9e2f7b1d3
Revises: e4c2a7b91f35
Create Date: 2026-10-21 12:00:00.000000

Questions 77 (lights) and 78 (shapes) ask about a vessel dredging or doing
underwater work, KVR rule 27 (b)/(d). They sit in the catalog's SeeSchStrO
block because they're set on the Elbe, and were classified into
seeschstro-kennzeichnung by their position. The SeeSchStrO has no lights or
shapes of its own for this, so they now belong to kvr-lichter-signale, where a
learner looks for them. Only topic_id changes; sync_catalog() upserts, so
question ids (and progress) survive.
"""

from collections.abc import Sequence

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "a4c9e2f7b1d3"
down_revision: str | None = "e4c2a7b91f35"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    # Topic assignment only; the previous one is in git history, not worth reconstructing.
    pass
