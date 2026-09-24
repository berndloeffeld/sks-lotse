import random

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exam_variant import subjects_for_variant
from app.core.jwt import get_current_user
from app.core.rate_limit import enforce_limit
from app.models.question import Question
from app.models.question_report import QuestionReport
from app.models.topic import Topic
from app.models.user import User
from app.schemas.question import QuestionRead, TopicRead
from app.schemas.question_report import QuestionReportCreate, QuestionReportRead
from app.services.catalog import catalog, catalog_by_id

router = APIRouter(prefix="/questions", tags=["questions"], dependencies=[Depends(get_current_user)])


def _filtered_catalog(
    request: Request,
    db: Session,
    current_user: User,
    subject: str | None,
    topic: str | None = None,
) -> list[QuestionRead]:
    questions = catalog(request, db)
    if subject is not None:
        # An explicit subject always wins over the learner's exam variant.
        questions = [q for q in questions if q.subject == subject]
    elif (allowed := subjects_for_variant(current_user.exam_variant)) is not None:
        questions = [q for q in questions if q.subject in allowed]
    if topic is not None:
        questions = [q for q in questions if q.topic == topic]
    return questions


@router.get("", response_model=list[QuestionRead])
def list_questions(
    request: Request,
    subject: str | None = None,
    topic: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _filtered_catalog(request, db, current_user, subject, topic)


@router.get("/random", response_model=QuestionRead)
def random_question(
    request: Request,
    subject: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    questions = _filtered_catalog(request, db, current_user, subject)
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found")
    return random.choice(questions)  # noqa: S311 - picking a practice question, not a secret


@router.get("/{question_id}", response_model=QuestionRead)
def get_question(request: Request, question_id: int, db: Session = Depends(get_db)):
    question = catalog_by_id(request, db).get(question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.post("/{question_id}/report", response_model=QuestionReportRead, status_code=status.HTTP_201_CREATED)
def report_question(
    request: Request,
    question_id: int,
    payload: QuestionReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Flag a question as faulty ("Frage melden", ADR-0030)."""
    # A second, per-user cap on top of the blanket per-IP one (app/main.py): the free text
    # ends up in front of the operator, so one account must not be able to flood it.
    enforce_limit(
        request.app,
        "question_report:user",
        str(current_user.id),
        settings.question_report_max_per_window,
        settings.question_report_window_seconds,
        "Too many reports",
    )
    if db.get(Question, question_id) is None:
        raise HTTPException(status_code=404, detail="Question not found")
    report = QuestionReport(
        user_id=current_user.id,
        question_id=question_id,
        category=payload.category,
        comment=payload.comment,
    )
    db.add(report)
    db.commit()
    return report


topics_router = APIRouter(prefix="/topics", tags=["questions"], dependencies=[Depends(get_current_user)])


@topics_router.get("", response_model=list[TopicRead])
def list_topics(
    subject: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Topic).order_by(Topic.subject, Topic.display_order)
    if subject is not None:
        # An explicit subject always wins over the learner's exam variant.
        stmt = stmt.where(Topic.subject == subject)
    elif (allowed := subjects_for_variant(current_user.exam_variant)) is not None:
        stmt = stmt.where(Topic.subject.in_(allowed))
    return db.execute(stmt).scalars().all()
