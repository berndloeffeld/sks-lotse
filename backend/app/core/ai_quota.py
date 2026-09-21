"""The weekly budget for AI answer checks (ADR-0036, was per day in ADR-0031): pure week/limit arithmetic.

The counters live on the user row (`ai_checks_week`, `ai_checks_used`) — persisted so a deploy can't
reset them, and gone with the account. The week starts on Monday 00:00 in Germany, since that is when
a learner expects "diese Woche" to turn over.

The limit is resolved per account: the operator's override on the user (`ai_checks_weekly_limit`), else
the operator's default from the `app_settings` table, else `GRADING_MAX_PER_WEEK`.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings

QUOTA_TIMEZONE = ZoneInfo("Europe/Berlin")
WEEKLY_DEFAULT_KEY = "ai_checks_weekly_default"


def current_week() -> date:
    """The Monday of the current week in Germany."""
    today = datetime.now(QUOTA_TIMEZONE).date()
    return today - timedelta(days=today.weekday())


def weekly_default(db: Session) -> int:
    # Imported here: app.models imports this module, so a top-level import would cycle.
    from app.models.app_setting import AppSetting

    row = db.get(AppSetting, WEEKLY_DEFAULT_KEY)
    return int(row.value) if row is not None else settings.grading_max_per_week


def effective_limit(db: Session, weekly_limit: int | None) -> int:
    return weekly_limit if weekly_limit is not None else weekly_default(db)


def remaining(week: date | None, used: int, limit: int) -> int:
    if week != current_week():
        return limit
    return max(limit - used, 0)
