from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.progress import LEARNED_STREAK_THRESHOLD
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress


def is_topic_fully_learned(db: Session, user_id: int, topic_id: int) -> bool:
    total = db.execute(
        select(func.count()).select_from(Question).where(Question.topic_id == topic_id)
    ).scalar_one()
    learned = db.execute(
        select(func.count())
        .select_from(Question)
        .join(QuestionProgress, QuestionProgress.question_id == Question.id)
        .where(
            Question.topic_id == topic_id,
            QuestionProgress.user_id == user_id,
            QuestionProgress.correct_streak >= LEARNED_STREAK_THRESHOLD,
        )
    ).scalar_one()
    return total > 0 and learned == total


def remove_focus_if_topic_learned(db: Session, user_id: int, topic_id: int) -> None:
    """Drop the learner's focus mark on a topic once all its questions are "gelernt".

    Permanent by design (docs/adr/0028-...): a later streak reset doesn't bring
    the mark back.
    """
    if is_topic_fully_learned(db, user_id, topic_id):
        db.execute(delete(FocusTopic).where(FocusTopic.user_id == user_id, FocusTopic.topic_id == topic_id))
        db.commit()
