"""Abuse-monitoring signal for the AI answer check (ADR-0040).

Split out of the old app/services/ai_quota.py once the weekly AI-check budget it also held
(ADR-0036) was dropped in favor of tokens being the sole spending control (ADR-0044) — this
sanitizer-flag counter is unrelated to that budget and outlived it.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def _locked_user(db: Session, user_id: int) -> User:
    # FOR UPDATE (a no-op on SQLite) serializes parallel updates; populate_existing because the
    # caller's own copy of the row may already be stale.
    stmt = select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
    return db.execute(stmt).scalar_one()


def record_sanitizer_flag(db: Session, user_id: int) -> int:
    """Bump the sanitizer-flag counter (ADR-0040). Never receives the triggering text."""
    user = _locked_user(db, user_id)
    user.ai_flags_count += 1
    user.ai_flags_last_at = datetime.now(UTC)
    db.commit()
    return user.ai_flags_count
