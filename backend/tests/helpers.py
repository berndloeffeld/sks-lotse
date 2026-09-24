from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.core.progress import FULL_GAIN, MIN_HALF_LIFE_DAYS, due_at
from app.models import User

# The account the `auth_headers` fixture (conftest.py) logs in as.
FIXTURE_EMAIL = "fixture-user@example.com"


def fixture_user(db_session) -> User:
    return db_session.query(User).filter_by(email=FIXTURE_EMAIL).one()


def make_admin(monkeypatch) -> None:
    """Put the fixture user on the ADMIN_EMAILS allowlist for this test."""
    monkeypatch.setattr(settings, "admin_emails", FIXTURE_EMAIL)


def progress_state(level: int, *, graded_days_ago: float = 0.0) -> dict:
    """QuestionProgress column values for a question graded ``level`` times "Richtig" in a row.

    0 = just failed; 1/2 = on the way (half-lives 2.5/6.25 days); 3+ = gelernt
    (15.6+ days) — as long as it was graded recently enough.
    """
    half_life = FULL_GAIN**level if level > 0 else MIN_HALF_LIFE_DAYS
    graded = datetime.now(UTC) - timedelta(days=graded_days_ago)
    return {"half_life_days": half_life, "last_graded_at": graded, "review_due_at": due_at(graded, half_life)}
