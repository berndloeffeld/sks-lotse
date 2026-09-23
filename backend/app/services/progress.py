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


def credit_correct_answers(db: Session, user_id: int, question_ids: list[int], now: datetime) -> None:
    """Record a "Richtig" for each question in one transaction (a finished exam, ADR-0037).

    One query for the questions, one for the learner's existing progress rows and one commit —
    instead of a lookup and a commit per question. Only if a concurrent grading created one of the
    rows in between does it fall back to `record_grading` question by question.
    """
    ids = sorted(set(question_ids))
    if not ids:
        return
    questions = list(db.execute(select(Question).where(Question.id.in_(ids))).scalars())
    existing = {
        row.question_id: row
        for row in db.execute(
            select(QuestionProgress).where(
                QuestionProgress.user_id == user_id, QuestionProgress.question_id.in_(ids)
            )
        ).scalars()
    }
    missing = [q.id for q in questions if q.id not in existing]
    new = {qid: QuestionProgress(user_id=user_id, question_id=qid) for qid in missing}
    rows = existing | new
    db.add_all(new.values())
    try:
        # New rows get their column defaults here, before the grading is applied to them.
        db.flush()
    except IntegrityError:
        db.rollback()
        for question in questions:
            record_grading(db, user_id, question, "richtig", now)
        return
    for question in questions:
        apply_grading(rows[question.id], "richtig", now, is_new=question.id not in existing)
    db.commit()
    # Several learned questions can share a topic — check each topic once.
    learned_topics = {q.topic_id for q in questions if q.topic_id is not None and is_learned(rows[q.id], now)}
    for topic_id in sorted(learned_topics):
        remove_focus_if_topic_learned(db, user_id, topic_id)
