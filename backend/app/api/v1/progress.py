from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exam_variant import EXAM_VARIANTS
from app.core.jwt import get_current_user
from app.core.progress import LEARNED_STREAK_THRESHOLD
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from app.schemas.progress import TopicProgressRead

router = APIRouter(prefix="/progress", tags=["progress"], dependencies=[Depends(get_current_user)])


@router.get("/summary", response_model=list[TopicProgressRead])
def progress_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TopicProgressRead]:
    topics_stmt = select(Topic).order_by(Topic.subject, Topic.display_order)
    if current_user.exam_variant is not None:
        allowed = EXAM_VARIANTS.get(current_user.exam_variant)
        if allowed is not None:
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
