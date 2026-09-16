import random

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import cache
from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import get_current_user
from app.models.question import Question
from app.schemas.question import QuestionRead

router = APIRouter(prefix="/questions", tags=["questions"], dependencies=[Depends(get_current_user)])

_CATALOG_CACHE_KEY = "questions:catalog"


def _catalog(request: Request, db: Session) -> list[QuestionRead]:
    def load() -> list[QuestionRead]:
        stmt = select(Question).order_by(Question.subject, Question.number)
        questions = db.execute(stmt).scalars().all()
        return [QuestionRead.model_validate(q) for q in questions]

    # The catalog only ever changes via the one-off import script (backend/scripts/import_catalog.py),
    # never through the API — this TTL just bounds how long a re-import takes to show up without
    # restarting the app, not a correctness requirement.
    return cache.get_or_set(request.app, _CATALOG_CACHE_KEY, settings.catalog_cache_ttl_seconds, load)


@router.get("", response_model=list[QuestionRead])
def list_questions(request: Request, subject: str | None = None, db: Session = Depends(get_db)):
    questions = _catalog(request, db)
    if subject is not None:
        questions = [q for q in questions if q.subject == subject]
    return questions


@router.get("/random", response_model=QuestionRead)
def random_question(request: Request, subject: str | None = None, db: Session = Depends(get_db)):
    questions = _catalog(request, db)
    if subject is not None:
        questions = [q for q in questions if q.subject == subject]
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found")
    return random.choice(questions)


@router.get("/{question_id}", response_model=QuestionRead)
def get_question(request: Request, question_id: int, db: Session = Depends(get_db)):
    for question in _catalog(request, db):
        if question.id == question_id:
            return question
    raise HTTPException(status_code=404, detail="Question not found")
