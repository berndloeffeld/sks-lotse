"""Reserving and refunding one AI check against the user's daily budget (ADR-0031)."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import ai_quota
from app.core.config import settings
from app.models.user import User


def _locked_user(db: Session, user_id: int) -> User:
    # FOR UPDATE (a no-op on SQLite) serializes parallel clicks so they can't both spend the last check;
    # populate_existing because the request's own copy of the row may already be stale.
    stmt = select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
    return db.execute(stmt).scalar_one()


def reserve(db: Session, user_id: int) -> tuple[int, date] | None:
    """Spend one check. Returns (checks left, the day it was booked on), or None if today's budget is gone."""
    user = _locked_user(db, user_id)
    day = ai_quota.today()
    if user.ai_checks_day != day:
        user.ai_checks_day = day
        user.ai_checks_used = 0
    if user.ai_checks_used >= settings.grading_max_per_day:
        db.commit()
        return None
    user.ai_checks_used += 1
    db.commit()
    return settings.grading_max_per_day - user.ai_checks_used, day


def refund(db: Session, user_id: int, day: date) -> None:
    """Give a reserved check back (the LLM call failed) — only if it was booked on the current counter day."""
    user = _locked_user(db, user_id)
    if user.ai_checks_day == day and user.ai_checks_used > 0:
        user.ai_checks_used -= 1
    db.commit()
