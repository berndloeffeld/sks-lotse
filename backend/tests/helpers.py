from datetime import UTC, datetime, timedelta

from app.core.progress import FULL_GAIN, MIN_HALF_LIFE_DAYS, due_at


def progress_state(level: int, *, graded_days_ago: float = 0.0) -> dict:
    """QuestionProgress column values for a question graded ``level`` times "Richtig" in a row.

    0 = just failed; 1/2 = on the way (half-lives 2.5/6.25 days); 3+ = gelernt
    (15.6+ days) — as long as it was graded recently enough.
    """
    half_life = FULL_GAIN**level if level > 0 else MIN_HALF_LIFE_DAYS
    graded = datetime.now(UTC) - timedelta(days=graded_days_ago)
    return {"half_life_days": half_life, "last_graded_at": graded, "review_due_at": due_at(graded, half_life)}
