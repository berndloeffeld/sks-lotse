"""What the two Lotsen-Check endpoints (catalog question, Kartenaufgabe) share: the quota caps,
reserving and refunding tokens around the LLM call, and the abuse-monitoring log.

The routers keep the HTTP side (which request is valid, what the response looks like); a change to
refunds or caps lands here once, not in two copies (ADR-0040, ADR-0043, ADR-0044, ADR-0058).
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import enforce_limit, forget_last
from app.models.user import User
from app.services import ai_abuse_monitoring, token_wallet
from app.services.grader import GradingUnavailable

logger = logging.getLogger(__name__)

DAY_SECONDS = 24 * 3600
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
    amount: int,
    caps: CheckCaps,
    grade: Callable[[], T],
    log_label: str,
) -> tuple[T, int]:
    """Enforce the caps, reserve `amount` tokens, run `grade`; returns its result and the tokens left.

    A check that never happened costs the learner nothing: the tokens and both caps are given back
    for any failure, not just the expected GradingUnavailable (which becomes a 503; anything else
    propagates). Never logs the learner's answer, only the reason.
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
