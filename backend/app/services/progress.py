from datetime import datetime
from typing import cast

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.progress import GradingOutcome, apply_grading, is_learned
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.services.focus import remove_focus_if_topic_learned


def _progress_row(db: Session, user_id: int, question_id: int) -> QuestionProgress | None:
    stmt = select(QuestionProgress).where(
        QuestionProgress.user_id == user_id, QuestionProgress.question_id == question_id
    )
    return db.execute(stmt).scalar_one_or_none()


def record_grading(
    db: Session, user_id: int, question: Question, outcome: str, now: datetime
) -> QuestionProgress | None:
    """Apply one grading to the learner's progress on a question and commit (ADR-0023/0034).

    None if the progress row a concurrent grading created has vanished again.
    """
    row = _progress_row(db, user_id, question.id)
    is_new = row is None
    if row is None:
        row = QuestionProgress(user_id=user_id, question_id=question.id)
        db.add(row)
        try:
            db.flush()
        except IntegrityError:
            # A concurrent first grading (double submit) inserted the row
            # between our read and this insert — apply this one on top of it.
            db.rollback()
            is_new = False
            row = _progress_row(db, user_id, question.id)
            if row is None:
                # The row that beat us is gone again (e.g. the account was
                # deleted meanwhile) — nothing sensible to apply the grading to.
                return None

    apply_grading(row, cast(GradingOutcome, outcome), now, is_new=is_new)
    db.commit()
    # Only a grading that just made this question "gelernt" can complete a topic.
    if is_learned(row, now) and question.topic_id is not None:
        remove_focus_if_topic_learned(db, user_id, question.topic_id)
    return row
