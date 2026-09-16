from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.models.question import Question
from app.schemas.question import QuestionRead

router = APIRouter(prefix="/questions", tags=["questions"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[QuestionRead])
def list_questions(subject: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Question)
    if subject is not None:
        stmt = stmt.where(Question.subject == subject)
    stmt = stmt.order_by(Question.subject, Question.number)
    return db.execute(stmt).scalars().all()


@router.get("/random", response_model=QuestionRead)
def random_question(subject: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Question)
    if subject is not None:
        stmt = stmt.where(Question.subject == subject)
    stmt = stmt.order_by(func.random()).limit(1)
    question = db.execute(stmt).scalars().first()
    if question is None:
        raise HTTPException(status_code=404, detail="No questions found")
    return question


@router.get("/{question_id}", response_model=QuestionRead)
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question
