import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.v1.questions import _catalog_by_id
from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import get_current_user
from app.core.rate_limit import check_and_record
from app.models.user import User
from app.schemas.grading import AiGradeRead, AiGradeRequest
from app.services.grader import GradingUnavailable, grade_answer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/questions", tags=["grading"], dependencies=[Depends(get_current_user)])


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
    if not check_and_record(
        request.app,
        "ai_grade:user",
        str(current_user.id),
        settings.grading_max_per_window,
        settings.grading_window_seconds,
    ):
        raise HTTPException(status_code=429, detail="Too many answer checks")
    try:
        result = grade_answer(question.question_text, question.answer_text, payload.answer)
    except GradingUnavailable as exc:
        # Reason only — the learner's answer is never logged.
        logger.warning("AI answer check unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="AI answer check is currently unavailable") from exc
    return AiGradeRead(outcome=result.outcome, feedback=result.feedback)
