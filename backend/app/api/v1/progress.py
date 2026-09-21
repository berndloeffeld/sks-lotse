from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.questions import _catalog_by_id
from app.core.database import get_db
from app.core.exam_variant import subjects_for_variant
from app.core.jwt import get_current_user
from app.core.progress import (
    is_learned,
    learned_clause,
    learning_clause,
    progress_fraction,
)
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from app.schemas.progress import QuestionGradeCreate, QuestionProgressRead, TopicProgressRead
from app.schemas.question import QuestionRead
from app.services.focus import is_topic_fully_learned
from app.services.progress import record_grading

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

    # One pass over the catalog, joined to this learner's progress: count() skips
    # the NULLs the CASEs yield for questions in the other bucket.
    now = datetime.now(UTC)
    counts_stmt = (
        select(
            Question.topic_id,
            func.count(Question.id),
            func.count(case((learned_clause(now), 1))),
            func.count(case((learning_clause(now), 1))),
        )
        .outerjoin(
            QuestionProgress,
            (QuestionProgress.question_id == Question.id) & (QuestionProgress.user_id == current_user.id),
        )
        .where(Question.topic_id.is_not(None))
        .group_by(Question.topic_id)
    )
    counts = {topic_id: (total, done, partial) for topic_id, total, done, partial in db.execute(counts_stmt)}

    focus_ids = set(
        db.execute(select(FocusTopic.topic_id).where(FocusTopic.user_id == current_user.id)).scalars()
    )

    return [
        TopicProgressRead(
            subject=topic.subject,
            topic_slug=topic.slug,
            topic_name=topic.name,
            display_order=topic.display_order,
            total_questions=counts.get(topic.id, (0, 0, 0))[0],
            learned_questions=counts.get(topic.id, (0, 0, 0))[1],
            learning_questions=counts.get(topic.id, (0, 0, 0))[2],
            is_focus=topic.id in focus_ids,
        )
        for topic in topics
    ]


def _topic_or_404(db: Session, user: User, subject: str, topic_slug: str) -> Topic:
    topic = db.execute(
        select(Topic).where(Topic.subject == subject, Topic.slug == topic_slug)
    ).scalar_one_or_none()
    allowed = subjects_for_variant(user.exam_variant)
    if topic is None or (allowed is not None and topic.subject not in allowed):
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.put("/focus/{subject}/{topic_slug}", status_code=204)
def add_focus_topic(
    subject: str,
    topic_slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Mark a topic as Fokus (idempotent, ADR-0028)."""
    topic = _topic_or_404(db, current_user, subject, topic_slug)
    if is_topic_fully_learned(db, current_user.id, topic.id):
        # It would be dropped again immediately — tell the client instead.
        raise HTTPException(status_code=409, detail="Topic is already fully learned")

    db.add(FocusTopic(user_id=current_user.id, topic_id=topic.id))
    try:
        db.commit()
    except IntegrityError:
        # Already marked (or a concurrent double submit) — same end state.
        db.rollback()


@router.delete("/focus/{subject}/{topic_slug}", status_code=204)
def remove_focus_topic(
    subject: str,
    topic_slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove a topic's Fokus mark (idempotent)."""
    topic = _topic_or_404(db, current_user, subject, topic_slug)
    db.execute(
        delete(FocusTopic).where(FocusTopic.user_id == current_user.id, FocusTopic.topic_id == topic.id)
    )
    db.commit()


@router.get("/focus/questions", response_model=list[QuestionRead])
def focus_session_questions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuestionRead]:
    """The Fokus session: open questions of all Fokus topics, oldest correct answer first.

    Never-answered questions come first, then never-correct ones, then by how long ago
    the last "Richtig" was, regardless of topic. Questions that are gelernt are left out (ADR-0028, ADR-0034).
    """
    now = datetime.now(UTC)
    stmt = (
        select(Question.id)
        .join(
            FocusTopic, (FocusTopic.topic_id == Question.topic_id) & (FocusTopic.user_id == current_user.id)
        )
        .outerjoin(
            QuestionProgress,
            (QuestionProgress.question_id == Question.id) & (QuestionProgress.user_id == current_user.id),
        )
        # An outer-joined row without progress is not learned; NOT(NULL) alone would drop it.
        .where(or_(QuestionProgress.id.is_(None), ~learned_clause(now)))
        .order_by(
            QuestionProgress.id.is_not(None),
            QuestionProgress.last_correct_at.is_not(None),
            QuestionProgress.last_correct_at,
            Question.id,
        )
    )
    if (allowed := subjects_for_variant(current_user.exam_variant)) is not None:
        stmt = stmt.where(Question.subject.in_(allowed))

    catalog = _catalog_by_id(request, db)
    return [catalog[question_id] for question_id in db.execute(stmt).scalars()]


def _question_progress_read(row: QuestionProgress, now: datetime) -> QuestionProgressRead:
    return QuestionProgressRead(
        question_id=row.question_id,
        progress=progress_fraction(row, now),
        learned=is_learned(row, now),
    )


@router.get("/questions", response_model=list[QuestionProgressRead])
def list_question_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuestionProgressRead]:
    # Only questions the caller has graded at least once have a row; the
    # client treats every other question as not started. At most one row per
    # catalog question (~500), so no paging.
    stmt = (
        select(QuestionProgress)
        .where(QuestionProgress.user_id == current_user.id)
        .order_by(QuestionProgress.question_id)
    )
    now = datetime.now(UTC)
    return [_question_progress_read(row, now) for row in db.execute(stmt).scalars()]


@router.post("/questions/{question_id}", response_model=QuestionProgressRead)
def grade_question(
    question_id: int,
    payload: QuestionGradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionProgressRead:
    """Record one grading of a question and re-estimate its half-life (ADR-0023/0034)."""
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    now = datetime.now(UTC)
    row = record_grading(db, current_user.id, question, payload.outcome, now)
    if row is None:
        raise HTTPException(status_code=409, detail="Progress changed concurrently, please retry")
    return _question_progress_read(row, now)
