import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.v1.questions import _catalog_by_id
from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import get_current_user
from app.core.rate_limit import check_and_record, forget_last
from app.models.user import User
from app.schemas.grading import AiGradeRead, AiGradeRequest
from app.services import ai_quota
from app.services.grader import GradingUnavailable, grade_answer

logger = logging.getLogger(__name__)

_DAY_SECONDS = 24 * 3600

router = APIRouter(prefix="/questions", tags=["grading"], dependencies=[Depends(get_current_user)])


def _record_and_log_if_flagged(
    db: Session, user: User, *, question_id: int, outcome: str, sanitized: bool
) -> None:
    """Bump the abuse-monitoring counter and, past the threshold, log extra detail (ADR-0040).

    Never logs the learner's answer or the model's feedback text — only metadata.
    """
    flags = ai_quota.record_sanitizer_flag(db, user.id) if sanitized else user.ai_flags_count
    if flags >= settings.grading_sanitizer_log_threshold:
        logger.warning(
            "ai-grade flagged-account activity: user=%s question=%s outcome=%s sanitized=%s flags=%s",
            user.id,
            question_id,
            outcome,
            sanitized,
            flags,
        )


@router.post("/{question_id}/ai-grade", response_model=AiGradeRead)
def ai_grade_answer(
    request: Request,
    question_id: int,
    payload: AiGradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suggest a grade + feedback for the learner's answer (ADR-0031). Stateless, saves no progress."""
    if not current_user.ai_grading_enabled:
        raise HTTPException(status_code=403, detail="AI answer check is not unlocked for this account")
    question = _catalog_by_id(request, db).get(question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    if not question.answer_text.strip():
        # The official answer is only a sketch (image not extracted) — nothing to compare against.
        raise HTTPException(status_code=409, detail="This question has no text answer to check against")
    # Three caps, cheapest first: per question and day (no rephrasing until it says "richtig"), per hour
    # (a brake on rapid-fire clicking), then the persisted daily budget, which is only spent on success.
    question_key = f"{current_user.id}:{question_id}"
    if not check_and_record(
        request.app,
        "ai_grade:question",
        question_key,
        settings.grading_max_per_question_per_day,
        _DAY_SECONDS,
    ):
        logger.warning(
            "ai-grade rate limit: user=%s question=%s bucket=per_question_day", current_user.id, question_id
        )
        raise HTTPException(status_code=429, detail="Too many checks for this question today")
    if not check_and_record(
        request.app,
        "ai_grade:user",
        str(current_user.id),
        settings.grading_max_per_window,
        settings.grading_window_seconds,
    ):
        logger.warning("ai-grade rate limit: user=%s bucket=per_hour", current_user.id)
        raise HTTPException(status_code=429, detail="Too many answer checks")
    reserved = ai_quota.reserve(db, current_user.id)
    if reserved is None:
        logger.warning("ai-grade rate limit: user=%s bucket=weekly_budget", current_user.id)
        raise HTTPException(status_code=429, detail="Weekly limit for answer checks reached")
    remaining_this_week, booked_on = reserved
    try:
        graded = grade_answer(question.question_text, question.answer_text, payload.answer)
    except GradingUnavailable as exc:
        # A check that never happened costs the learner nothing: budget and both caps are given back.
        ai_quota.refund(db, current_user.id, booked_on)
        forget_last(request.app, "ai_grade:question", question_key)
        forget_last(request.app, "ai_grade:user", str(current_user.id))
        # Reason only — the learner's answer is never logged.
        logger.warning("AI answer check unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="AI answer check is currently unavailable") from exc
    result = graded.result
    _record_and_log_if_flagged(
        db, current_user, question_id=question.id, outcome=result.outcome, sanitized=graded.sanitized
    )
    return AiGradeRead(
        outcome=result.outcome, feedback=result.feedback, remaining_this_week=remaining_this_week
    )
