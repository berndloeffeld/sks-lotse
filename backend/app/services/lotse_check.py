"""What the two Lotsen-Check endpoints (catalog question, Kartenaufgabe) share: the quota caps,
reserving and refunding tokens around the LLM call, and the abuse-monitoring log.

The routers keep the HTTP side (which request is valid, what the response looks like); a change to
refunds or caps lands here once, not in two copies (ADR-0040, ADR-0043, ADR-0044, ADR-0058).
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import enforce_limit, forget_last
from app.models.lotse_check_log import LotseCheckLog
from app.models.user import User
from app.services import ai_abuse_monitoring, token_wallet
from app.services.grader import GradingUnavailable

logger = logging.getLogger(__name__)

DAY_SECONDS = 24 * 3600
# The KPI report looks back 7 days; the log keeps a month for margin (ADR-0032 addendum 2026-10-05).
CHECK_LOG_RETENTION = timedelta(days=30)
USER_BUCKET = "ai_grade:user"


@dataclass(frozen=True)
class CheckCaps:
    """The two caps of one check: a first one specific to the endpoint, then the hourly per-user one
    both endpoints share. Cheapest first; a request the hourly cap turns away gets its first hit
    back, since no check ran."""

    bucket: str
    key: str
    limit: int
    window_seconds: int
    detail: str
    log_label: str
    log: str | None = None

    def enforce(self, app, user_id: int) -> None:
        enforce_limit(app, self.bucket, self.key, self.limit, self.window_seconds, self.detail, self.log)
        try:
            enforce_limit(
                app,
                USER_BUCKET,
                str(user_id),
                settings.grading_max_per_window,
                settings.grading_window_seconds,
                "Too many answer checks",
                f"{self.log_label} rate limit: user={user_id} bucket=per_hour",
            )
        except HTTPException:
            forget_last(app, self.bucket, self.key)
            raise

    def give_back(self, app, user_id: int) -> None:
        """Undo both hits `enforce` recorded: for a check that never happened."""
        forget_last(app, self.bucket, self.key)
        forget_last(app, USER_BUCKET, str(user_id))


def run_paid_check[T](
    app,
    db: Session,
    user: User,
    *,
    kind: str,
    amount: int,
    caps: CheckCaps,
    grade: Callable[[], T],
    log_label: str,
) -> tuple[T, int]:
    """Enforce the caps, reserve `amount` tokens, run `grade`; returns its result and the tokens left.

    A check that never happened costs the learner nothing: the tokens and both caps are given back
    for any failure, not just the expected GradingUnavailable (which becomes a 503; anything else
    propagates). A check that ran is logged for the KPI report (`kind`: "catalog" or "chart").
    Never logs the learner's answer, only the reason.
    """
    caps.enforce(app, user.id)
    tokens_remaining = token_wallet.reserve(db, user.id, amount)
    if tokens_remaining is None:
        # Someone else spent the account's last tokens between the caller's balance check and here.
        caps.give_back(app, user.id)
        raise HTTPException(status_code=402, detail="Not enough tokens for an answer check")
    try:
        graded = grade()
    except Exception as exc:
        token_wallet.refund(db, user.id, amount)
        caps.give_back(app, user.id)
        if not isinstance(exc, GradingUnavailable):
            raise
        logger.warning("%s unavailable: %s", log_label, exc)
        raise HTTPException(status_code=503, detail="AI answer check is currently unavailable") from exc
    # Counted for the KPI report only (no user, no content); a failure here must not cost the
    # learner the result they already paid for.
    try:
        db.add(LotseCheckLog(kind=kind, tokens=amount))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not record a Lotsen-Check for the KPI report")
    return graded, tokens_remaining


def record_sanitizer_flag_and_log(
    db: Session, user: User, *, sanitized: bool, log_label: str, detail: str
) -> None:
    """Bump the abuse-monitoring counter and, past the threshold, log extra detail (ADR-0040).

    Never logs the learner's answer or the model's feedback text, only metadata (`detail`).
    """
    flags = ai_abuse_monitoring.record_sanitizer_flag(db, user.id) if sanitized else user.ai_flags_count
    if flags >= settings.grading_sanitizer_log_threshold:
        logger.warning(
            "%s flagged-account activity: user=%s %s sanitized=%s flags=%s",
            log_label,
            user.id,
            detail,
            sanitized,
            flags,
        )


def purge_check_log(db: Session, now: datetime) -> int:
    """Delete the log rows the KPI report no longer needs; returns how many."""
    result = db.execute(delete(LotseCheckLog).where(LotseCheckLog.checked_at < now - CHECK_LOG_RETENTION))
    db.commit()
    return result.rowcount  # type: ignore[attr-defined] # a DELETE's result is a CursorResult
