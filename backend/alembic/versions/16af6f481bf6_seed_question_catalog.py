"""seed question catalog

Revision ID: 16af6f481bf6
Revises: 7d518ffd1fbd
Create Date: 2026-09-18 09:57:48.384506

Populates questions/topics from the committed source files (the catalog PDF
plus the reviewed YAML fixtures under backend/scripts/data/) rather than
relying on someone remembering to run the manual scripts against every
environment — see app/services/catalog_seed.py and CLAUDE.md → Question
Catalog. Runs automatically wherever `alembic upgrade head` runs, including
Render's startCommand before every deploy. Calls no external API; the LLM
classification step already ran locally and its output is committed.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "16af6f481bf6"
down_revision: str | None = "7d518ffd1fbd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Superseded: e5b3a9c1d720 is the oldest migration that still syncs the catalog. Every sync
    # runs today's build_catalog(), not the one of its revision, so on a fresh database this one
    # would only write what e5b3a9c1d720 writes again. Databases past this revision (production)
    # already ran it.
    pass


def downgrade() -> None:
    op.execute("DELETE FROM questions")
    op.execute("DELETE FROM topics")
