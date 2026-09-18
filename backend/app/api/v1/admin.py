from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import require_admin
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.user import User
from app.schemas.admin import (
    AdminQuestionProgressExport,
    AdminUserExport,
    AdminUserRead,
    AdminUserSearchRequest,
)
from app.services.user import delete_user_and_progress

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND)


def _question_progress_count(db: Session, user_id: int) -> int:
    return db.execute(
        select(func.count()).select_from(QuestionProgress).where(QuestionProgress.user_id == user_id)
    ).scalar_one()


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise _NOT_FOUND
    return user


@router.post("/users/search", response_model=AdminUserRead)
def search_user(payload: AdminUserSearchRequest, db: Session = Depends(get_db)) -> AdminUserRead:
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if user is None:
        raise _NOT_FOUND
    return AdminUserRead(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        exam_variant=user.exam_variant,
        question_progress_count=_question_progress_count(db, user.id),
    )


@router.get("/users/{user_id}/export", response_model=AdminUserExport)
def export_user(user_id: int, db: Session = Depends(get_db)) -> AdminUserExport:
    user = _get_user_or_404(db, user_id)

    rows = db.execute(
        select(QuestionProgress, Question.subject, Question.number)
        .join(Question, Question.id == QuestionProgress.question_id)
        .where(QuestionProgress.user_id == user_id)
    ).all()

    return AdminUserExport(
        user=AdminUserRead(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
            exam_variant=user.exam_variant,
            question_progress_count=len(rows),
        ),
        question_progress=[
            AdminQuestionProgressExport(
                question_id=progress.question_id,
                subject=subject,
                question_number=number,
                correct_streak=progress.correct_streak,
                created_at=progress.created_at,
                updated_at=progress.updated_at,
            )
            for progress, subject, number in rows
        ],
        exported_at=datetime.now(UTC),
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)) -> None:
    user = _get_user_or_404(db, user_id)
    delete_user_and_progress(db, user)
