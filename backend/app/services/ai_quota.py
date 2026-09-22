"""Reserving and refunding one AI check against the user's weekly budget (ADR-0036)."""

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import ai_quota
from app.models.app_setting import AppSetting
from app.models.user import User


def _locked_user(db: Session, user_id: int) -> User:
    # FOR UPDATE (a no-op on SQLite) serializes parallel clicks so they can't both spend the last check;
    # populate_existing because the request's own copy of the row may already be stale.
    stmt = select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
    return db.execute(stmt).scalar_one()


def reserve(db: Session, user_id: int) -> tuple[int, date] | None:
    """Spend one check. Returns (checks left, the week it was booked on), or None if the budget is gone."""
    user = _locked_user(db, user_id)
    week = ai_quota.current_week()
    if user.ai_checks_week != week:
        user.ai_checks_week = week
        user.ai_checks_used = 0
    limit = user.ai_checks_limit
    if user.ai_checks_used >= limit:
        db.commit()
        return None
    user.ai_checks_used += 1
    db.commit()
    return limit - user.ai_checks_used, week


def refund(db: Session, user_id: int, week: date) -> None:
    """Give a reserved check back (the LLM call failed) — only if booked on the current counter week."""
    user = _locked_user(db, user_id)
    if user.ai_checks_week == week and user.ai_checks_used > 0:
        user.ai_checks_used -= 1
    db.commit()


def record_sanitizer_flag(db: Session, user_id: int) -> int:
    """Bump the sanitizer-flag counter (ADR-0040). Never receives the triggering text."""
    user = _locked_user(db, user_id)
    user.ai_flags_count += 1
    user.ai_flags_last_at = datetime.now(UTC)
    db.commit()
    return user.ai_flags_count


def set_weekly_default(db: Session, value: int) -> None:
    row = db.get(AppSetting, ai_quota.WEEKLY_DEFAULT_KEY)
    if row is None:
        db.add(AppSetting(key=ai_quota.WEEKLY_DEFAULT_KEY, value=str(value)))
    else:
        row.value = str(value)
    db.commit()
