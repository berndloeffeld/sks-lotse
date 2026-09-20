"""The daily budget for AI answer checks (ADR-0031): pure day/remaining arithmetic.

The counters live on the user row (`ai_checks_day`, `ai_checks_used`) — persisted so a deploy can't
reset them, and gone with the account. The day is the calendar day in Germany, since that is when
a learner expects "heute" to end.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings

QUOTA_TIMEZONE = ZoneInfo("Europe/Berlin")


def today() -> date:
    return datetime.now(QUOTA_TIMEZONE).date()


def remaining(day: date | None, used: int) -> int:
    limit = settings.grading_max_per_day
    if day != today():
        return limit
    return max(limit - used, 0)
