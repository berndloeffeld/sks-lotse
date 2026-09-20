"""add question_images and answer_images to questions, drop image_ref

Revision ID: e5b3a9c1d720
Revises: c3d8f1a47e59
Create Date: 2026-09-20 18:00:00.000000

The catalog PDF embeds 23 charts and sketches (light configurations, weather
maps, mooring sketches, ...). They're extracted into frontend/public/catalog/
and listed in backend/scripts/data/question_images.yaml; each question gets the
images of its question part and of its official answer as two JSON lists of
{src, width, height}. That replaces `image_ref`, which was never filled — see
ADR-0033. The data half re-syncs the catalog, so the images land with the columns.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "e5b3a9c1d720"
down_revision: str | None = "c3d8f1a47e59"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("question_images", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("questions", sa.Column("answer_images", sa.JSON(), server_default="[]", nullable=False))
    op.drop_column("questions", "image_ref")
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    op.add_column("questions", sa.Column("image_ref", sa.String(length=255), nullable=True))
    op.drop_column("questions", "answer_images")
    op.drop_column("questions", "question_images")
