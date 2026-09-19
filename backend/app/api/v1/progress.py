from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exam_variant import subjects_for_variant
from app.core.jwt import get_current_user
from app.core.progress import LEARNED_STREAK_THRESHOLD, is_learned, next_streak
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from app.schemas.progress import QuestionGradeCreate, QuestionProgressRead, TopicProgressRead

router = APIRouter(prefix="/progress", tags=["progress"], dependencies=[Depends(get_current_user)])


@router.get("/summary", response_model=list[TopicProgressRead])
def progress_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TopicProgressRead]:
    topics_stmt = select(Topic).order_by(Topic.subject, Topic.display_order)
    if (allowed := subjects_for_variant(current_user.exam_variant)) is not None:
        topics_stmt = topics_stmt.where(Topic.subject.in_(allowed))
    topics = db.execute(topics_stmt).scalars().all()

    totals_stmt = (
        select(Question.topic_id, func.count())
        .where(Question.topic_id.is_not(None))
        .group_by(Question.topic_id)
    )
    totals = dict(db.execute(totals_stmt).all())

    learned_stmt = (
        select(Question.topic_id, func.count())
        .join(QuestionProgress, QuestionProgress.question_id == Question.id)
        .where(
            QuestionProgress.user_id == current_user.id,
            QuestionProgress.correct_streak >= LEARNED_STREAK_THRESHOLD,
            Question.topic_id.is_not(None),
        )
        .group_by(Question.topic_id)
    )
    learned = dict(db.execute(learned_stmt).all())

    return [
        TopicProgressRead(
            subject=topic.subject,
            topic_slug=topic.slug,
            topic_name=topic.name,
            display_order=topic.display_order,
            total_questions=totals.get(topic.id, 0),
            learned_questions=learned.get(topic.id, 0),
        )
        for topic in topics
    ]


def _question_progress_read(row: QuestionProgress) -> QuestionProgressRead:
    return QuestionProgressRead(
        question_id=row.question_id,
        correct_streak=row.correct_streak,
        learned=is_learned(row.correct_streak),
    )


@router.get("/questions", response_model=list[QuestionProgressRead])
def list_question_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuestionProgressRead]:
    # Only questions the caller has graded at least once have a row; the
    # client treats every other question as streak 0. At most one row per
    # catalog question (~500), so no paging.
    stmt = (
        select(QuestionProgress)
        .where(QuestionProgress.user_id == current_user.id)
        .order_by(QuestionProgress.question_id)
    )
    return [_question_progress_read(row) for row in db.execute(stmt).scalars()]


def _progress_row(db: Session, user_id: int, question_id: int) -> QuestionProgress | None:
    stmt = select(QuestionProgress).where(
        QuestionProgress.user_id == user_id, QuestionProgress.question_id == question_id
    )
    return db.execute(stmt).scalar_one_or_none()


@router.post("/questions/{question_id}", response_model=QuestionProgressRead)
def grade_question(
    question_id: int,
    payload: QuestionGradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionProgressRead:
    """Record one grading of a question and move its streak (ADR-0018/0023)."""
    if db.get(Question, question_id) is None:
        raise HTTPException(status_code=404, detail="Question not found")

    row = _progress_row(db, current_user.id, question_id)
    if row is None:
        row = QuestionProgress(user_id=current_user.id, question_id=question_id, correct_streak=0)
        db.add(row)
        try:
            db.flush()
        except IntegrityError:
            # A concurrent first grading (double submit) inserted the row
            # between our read and this insert — apply this one on top of it.
            db.rollback()
            row = _progress_row(db, current_user.id, question_id)
            assert row is not None

    row.correct_streak = next_streak(row.correct_streak, payload.outcome)
    db.commit()
    return _question_progress_read(row)
