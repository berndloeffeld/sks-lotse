from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import get_current_user
from app.models.user import User
from app.schemas.grading import AiGradeRead, AiGradeRequest
from app.services import lotse_check, token_wallet
from app.services.catalog import catalog_by_id
from app.services.grader import grade_answer

router = APIRouter(prefix="/questions", tags=["grading"], dependencies=[Depends(get_current_user)])


def _caps(user_id: int, question_id: int) -> lotse_check.CheckCaps:
    """Per question and day (no rephrasing until it says "richtig"), then per hour (a brake on
    rapid-fire clicking) — on top of the token balance itself (ADR-0044: tokens are the sole
    spending control, no separate weekly budget anymore)."""
    return lotse_check.CheckCaps(
        bucket="ai_grade:question",
        key=f"{user_id}:{question_id}",
        limit=settings.grading_max_per_question_per_day,
        window_seconds=lotse_check.DAY_SECONDS,
        detail="Too many checks for this question today",
        log=f"ai-grade rate limit: user={user_id} question={question_id} bucket=per_question_day",
        log_label="ai-grade",
    )


@router.post("/{question_id}/ai-grade", response_model=AiGradeRead)
def ai_grade_answer(
    request: Request,
    question_id: int,
    payload: AiGradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suggest a grade + feedback for the answer (ADR-0031, ADR-0043). Stateless, saves no progress."""
    if current_user.token_balance < token_wallet.TOKENS_PER_ANSWER_CHECK:
        raise HTTPException(status_code=402, detail="Not enough tokens for an answer check")
    question = catalog_by_id(request, db).get(question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    if not question.answer_text.strip():
        # The official answer is only a sketch (image not extracted) — nothing to compare against.
        raise HTTPException(status_code=409, detail="This question has no text answer to check against")
    result_and_sanitized, tokens_remaining = lotse_check.run_paid_check(
        request.app,
        db,
        current_user,
        kind="catalog",
        amount=token_wallet.TOKENS_PER_ANSWER_CHECK,
        caps=_caps(current_user.id, question_id),
        grade=lambda: grade_answer(question.question_text, question.answer_text, payload.answer),
        log_label="AI answer check",
    )
    result = result_and_sanitized.result
    lotse_check.record_sanitizer_flag_and_log(
        db,
        current_user,
        sanitized=result_and_sanitized.sanitized,
        log_label="ai-grade",
        detail=f"question={question.id} outcome={result.outcome}",
    )
    return AiGradeRead(
        outcome=result.outcome,
        feedback=result.feedback,
        richtig_genannt=result.richtig_genannt,
        fehlt=result.fehlt,
        tokens_remaining=tokens_remaining,
    )
