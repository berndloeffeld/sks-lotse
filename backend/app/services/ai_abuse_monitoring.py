"""Abuse-monitoring signal for the AI answer check (ADR-0040).

Split out of the old app/services/ai_quota.py once the weekly AI-check budget it also held
(ADR-0036) was dropped in favor of tokens being the sole spending control (ADR-0044) — this
sanitizer-flag counter is unrelated to that budget and outlived it.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.services.user import locked_user


def record_sanitizer_flag(db: Session, user_id: int) -> int:
    """Bump the sanitizer-flag counter (ADR-0040). Never receives the triggering text."""
    user = locked_user(db, user_id)
    user.ai_flags_count += 1
    user.ai_flags_last_at = datetime.now(UTC)
    db.commit()
    return user.ai_flags_count
