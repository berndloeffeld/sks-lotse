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
from app.services.catalog_seed import build_catalog, sync_catalog

# revision identifiers, used by Alembic.
revision: str = "16af6f481bf6"
down_revision: str | None = "7d518ffd1fbd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Core statements on the migration's own connection/transaction, never
    # the ORM models — see the catalog_seed module docstring.
    sync_catalog(op.get_bind(), build_catalog())


def downgrade() -> None:
    op.execute("DELETE FROM questions")
    op.execute("DELETE FROM topics")
