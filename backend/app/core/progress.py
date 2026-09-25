"""The "gelernt" rule: a per-question memory half-life, moved by each self-grading.

Duolingo-style half-life model (docs/adr/0034-half-life-model-for-gelernt.md,
superseding the streak rule of docs/adr/0018-...): recall probability decays as
``p = 2 ** (-elapsed / half_life)``, and every grading re-estimates the half-life.
Unlike Duolingo's regression, the update factors below are fixed constants, not
weights fitted on review logs — there is no data to fit them on yet.

Within an unbroken "Richtig" streak, the spacing effect is measured against the
streak's first "Richtig", not just the previous grading (docs/adr/0039-cumulative-
spacing-for-richtig-streaks.md) — see ``apply_grading()``.
"""

import math
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import ColumnElement, and_

from app.core.timeutil import as_utc
from app.models.question_progress import QuestionProgress

# The three outcomes of the self-assessment control (ADR-0014), in the
# order the UI lists them.
GradingOutcome = Literal["richtig", "teilweise_richtig", "falsch"]

# Half-life assumed before a question has been graded (and the floor for
# "on the way": a half-life above it means at least one solid recall).
INITIAL_HALF_LIFE_DAYS = 1.0
MIN_HALF_LIFE_DAYS = 0.25
MAX_HALF_LIFE_DAYS = 365.0
# A question is "gelernt" once its half-life reaches this ...
LEARNED_HALF_LIFE_DAYS = 7.0
# ... and stays so until the estimated recall probability drops below this,
# at which point it resurfaces (review_due_at).
RECALL_THRESHOLD = 0.7

# The Auffrischen session (docs/adr/0049-...): questions that were gelernt (half-life at the
# bar) and whose due date has passed or falls within the window, a random sample of this size.
REFRESH_WINDOW_DAYS = 2
REFRESH_SESSION_SIZE = 20
# At least this share of a session comes from the possibly faded (lapsed) questions.
REFRESH_LAPSED_SHARE = 0.7

# How a grading scales the half-life. A "Richtig" grows it by up to FULL_GAIN,
# scaled by how much of the current half-life has elapsed since the last
# grading (spacing effect: re-answering right away proves little).
FULL_GAIN = 2.5
_SETBACK_FACTORS = {"teilweise_richtig": 0.5, "falsch": 0.25}


def next_half_life(half_life_days: float, elapsed_days: float | None, outcome: GradingOutcome) -> float:
    """The half-life after one grading; ``elapsed_days`` is None for a first grading."""
    if outcome == "richtig":
        spacing = 1.0 if elapsed_days is None else min(max(elapsed_days, 0.0) / half_life_days, 1.0)
        updated = half_life_days * (1 + (FULL_GAIN - 1) * spacing)
    else:
        updated = half_life_days * _SETBACK_FACTORS[outcome]
    return min(max(updated, MIN_HALF_LIFE_DAYS), MAX_HALF_LIFE_DAYS)


def due_at(last_graded_at: datetime, half_life_days: float) -> datetime:
    """When the recall probability falls to RECALL_THRESHOLD — the question resurfaces."""
    return last_graded_at + timedelta(days=half_life_days * math.log2(1 / RECALL_THRESHOLD))


def apply_grading(row: QuestionProgress, outcome: GradingOutcome, now: datetime, *, is_new: bool) -> None:
    """Apply one grading; ``is_new`` marks a question's very first grading ever.

    A "Richtig" that continues an unbroken streak (row.streak_start_at already set)
    measures spacing cumulatively from the streak's first "Richtig", so a run of
    quick re-confirmations after a setback still earns growing credit instead of
    each step being judged against only the one before it. The streak's own first
    "Richtig" — and any grading outside a streak — is unaffected: it's still judged
    against the previous grading, same as before docs/adr/0039-...
    """
    if outcome == "richtig" and not is_new and row.streak_start_at is not None:
        continuing_streak = True
        since = row.streak_start_at
    else:
        continuing_streak = False
        since = row.last_graded_at
    elapsed = None if is_new else (now - as_utc(since)).total_seconds() / 86400
    row.half_life_days = next_half_life(row.half_life_days, elapsed, outcome)
    if outcome == "richtig":
        row.streak_start_at = row.streak_start_at if continuing_streak else now
        row.last_correct_at = now
    else:
        row.streak_start_at = None
    row.last_graded_at = now
    row.review_due_at = due_at(now, row.half_life_days)


def is_learned(row: QuestionProgress, now: datetime) -> bool:
    return row.half_life_days >= LEARNED_HALF_LIFE_DAYS and as_utc(row.review_due_at) > now


def learned_clause(now: datetime) -> ColumnElement[bool]:
    """SQL twin of is_learned()."""
    return and_(
        QuestionProgress.half_life_days >= LEARNED_HALF_LIFE_DAYS, QuestionProgress.review_due_at > now
    )


def refresh_clause(now: datetime) -> ColumnElement[bool]:
    """Was gelernt and has lapsed or is about to: half-life at the bar, due within the window."""
    return and_(
        QuestionProgress.half_life_days >= LEARNED_HALF_LIFE_DAYS,
        QuestionProgress.review_due_at <= now + timedelta(days=REFRESH_WINDOW_DAYS),
    )


def lapsed_clause(now: datetime) -> ColumnElement[bool]:
    """Was gelernt (half-life at the bar) but the due date has passed."""
    return and_(
        QuestionProgress.half_life_days >= LEARNED_HALF_LIFE_DAYS, QuestionProgress.review_due_at <= now
    )


def refresh_quota(lapsed_available: int, expiring_available: int) -> tuple[int, int]:
    """How many lapsed and how many soon-lapsing questions a session takes.

    Lapsed questions get at least REFRESH_LAPSED_SHARE of the seats; seats the soon-lapsing pool
    can't fill go to more lapsed ones, and the other way round.
    """
    lapsed_seats = math.ceil(REFRESH_SESSION_SIZE * REFRESH_LAPSED_SHARE)
    lapsed = min(lapsed_available, max(lapsed_seats, REFRESH_SESSION_SIZE - expiring_available))
    expiring = min(expiring_available, REFRESH_SESSION_SIZE - lapsed)
    return lapsed, expiring


def learning_clause(now: datetime) -> ColumnElement[bool]:
    """ "Teilweise gelernt": answered right at least once, but not (or no longer) gelernt."""
    return and_(QuestionProgress.half_life_days > INITIAL_HALF_LIFE_DAYS, ~learned_clause(now))


def progress_fraction(row: QuestionProgress, now: datetime) -> float:
    """0 to 1 for the course gauge (ADR-0024: a position, never a step count)."""
    if is_learned(row, now):
        return 1.0
    # Measured from the floor, not from INITIAL_HALF_LIFE_DAYS: a "Richtig" after a setback (half-life
    # below the initial one) still moves the boat, even if it doesn't yet count as "on the way".
    reached = math.log(row.half_life_days / MIN_HALF_LIFE_DAYS) / math.log(
        LEARNED_HALF_LIFE_DAYS / MIN_HALF_LIFE_DAYS
    )
    # Never full unless learned — a decayed question sits just short of it.
    return min(max(reached, 0.0), 0.95)
