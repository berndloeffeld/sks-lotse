import random

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core import cache
from app.core.config import settings
from app.core.database import get_db
from app.core.exam_variant import EXAM_VARIANTS
from app.core.jwt import get_current_user
from app.models.question import Question
from app.models.topic import Topic
from app.models.user import User
from app.schemas.question import QuestionRead, TopicRead

router = APIRouter(prefix="/questions", tags=["questions"], dependencies=[Depends(get_current_user)])

_CATALOG_CACHE_KEY = "questions:catalog"
# Subjects with no assigned topic (or not yet classified) sort after every topic within their subject.
_NO_TOPIC_ORDER = 1_000_000


def _catalog(request: Request, db: Session) -> list[QuestionRead]:
    def load() -> list[QuestionRead]:
        stmt = select(Question).options(joinedload(Question.topic))
        questions = db.execute(stmt).unique().scalars().all()
        questions = sorted(
            questions,
            key=lambda q: (q.subject, q.topic.display_order if q.topic else _NO_TOPIC_ORDER, q.number),
        )
        return [QuestionRead.model_validate(q) for q in questions]

    # The catalog only ever changes via the one-off import/classification scripts
    # (backend/scripts/import_catalog.py, merge_seemannschaft.py, manage_topics.py), never through
    # the API — this TTL just bounds how long those changes take to show up without restarting the
    # app, not a correctness requirement.
    return cache.get_or_set(request.app, _CATALOG_CACHE_KEY, settings.catalog_cache_ttl_seconds, load)


def _filtered_catalog(
    request: Request,
    db: Session,
    current_user: User,
    subject: str | None,
    topic: str | None = None,
) -> list[QuestionRead]:
    questions = _catalog(request, db)
    if subject is not None:
        # An explicit subject always wins over the learner's exam variant.
        questions = [q for q in questions if q.subject == subject]
    elif current_user.exam_variant is not None:
        allowed = EXAM_VARIANTS.get(current_user.exam_variant)
        if allowed is not None:
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
    return random.choice(questions)


@router.get("/{question_id}", response_model=QuestionRead)
def get_question(request: Request, question_id: int, db: Session = Depends(get_db)):
    for question in _catalog(request, db):
        if question.id == question_id:
            return question
    raise HTTPException(status_code=404, detail="Question not found")


topics_router = APIRouter(prefix="/topics", tags=["questions"], dependencies=[Depends(get_current_user)])


@topics_router.get("", response_model=list[TopicRead])
def list_topics(subject: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Topic).order_by(Topic.subject, Topic.display_order)
    if subject is not None:
        stmt = stmt.where(Topic.subject == subject)
    return db.execute(stmt).scalars().all()
