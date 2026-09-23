"""Exam attempts as the API presents them (ADR-0029): status, deadline, points and read models.

The routes in app/api/v1/exams.py own the HTTP side (ownership checks, 404/409); the scoring rules
themselves live in app/core/exam.py.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exam import (
    MAX_POINTS,
    OUTCOME_POINTS,
    POINTS_PER_QUESTION,
    SUBJECT_GROUPS,
    ExamStatus,
    result_for,
)
from app.core.timeutil import as_utc
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.question import Question
from app.models.user import User
from app.schemas.exam import ExamGroupScore, ExamQuestionRead, ExamRead
from app.schemas.question import QuestionImage


def now() -> datetime:
    return datetime.now(UTC)


def status(attempt: ExamAttempt) -> ExamStatus:
    if attempt.submitted_at is None:
        return "in_progress"
    return "grading" if attempt.graded_at is None else "completed"


def expire_if_due(db: Session, attempt: ExamAttempt) -> None:
    """Auto-submits an attempt whose 90 minutes are over (no scheduler needed: checked on access)."""
    if attempt.submitted_at is None and now() >= as_utc(attempt.deadline_at):
        attempt.submitted_at = attempt.deadline_at
        attempt.timed_out = True
        db.commit()


def running_attempts(db: Session, user: User) -> list[ExamAttempt]:
    """The learner's exams still in progress after auto-submitting any past their deadline.

    Only unsubmitted attempts can be overdue (and at most one exists per learner), so the
    history never has to be loaded just to look for them.
    """
    stmt = select(ExamAttempt).where(ExamAttempt.user_id == user.id, ExamAttempt.submitted_at.is_(None))
    attempts = list(db.execute(stmt).scalars())
    for attempt in attempts:
        expire_if_due(db, attempt)
    return [attempt for attempt in attempts if attempt.submitted_at is None]


def own_attempts(db: Session, user: User) -> list[ExamAttempt]:
    running_attempts(db, user)
    stmt = select(ExamAttempt).where(ExamAttempt.user_id == user.id).order_by(ExamAttempt.started_at.desc())
    return list(db.execute(stmt).scalars())


def points(question: ExamAttemptQuestion) -> int | None:
    return None if question.outcome is None else OUTCOME_POINTS[question.outcome]


def total_points(attempt: ExamAttempt) -> int:
    return sum(points(q) or 0 for q in attempt.questions)


def group_scores(attempts: list[ExamAttempt]) -> list[ExamGroupScore]:
    earned = dict.fromkeys(SUBJECT_GROUPS, 0)
    possible = dict.fromkeys(SUBJECT_GROUPS, 0)
    for attempt in attempts:
        for question in attempt.questions:
            earned[question.subject_group] += points(question) or 0
            possible[question.subject_group] += POINTS_PER_QUESTION
    return [ExamGroupScore(subject_group=g, points=earned[g], max_points=possible[g]) for g in SUBJECT_GROUPS]


def summary_fields(attempt: ExamAttempt) -> dict:
    completed = status(attempt) == "completed"
    earned = total_points(attempt) if completed else None
    return {
        "id": attempt.id,
        "status": status(attempt),
        "exam_variant": attempt.exam_variant,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "timed_out": attempt.timed_out,
        "answered_count": sum(1 for q in attempt.questions if q.answer_text and q.answer_text.strip()),
        "question_count": len(attempt.questions),
        "points": earned,
        "max_points": MAX_POINTS,
        "result": result_for(earned) if earned is not None else None,
    }


def read_exam(db: Session, attempt: ExamAttempt) -> ExamRead:
    catalog = {}
    question_ids = [q.question_id for q in attempt.questions if q.question_id is not None]
    if question_ids:
        catalog = {
            q.id: q for q in db.execute(select(Question).where(Question.id.in_(question_ids))).scalars()
        }
    revealed = status(attempt) != "in_progress"
    questions = []
    for eq in attempt.questions:
        source = catalog.get(eq.question_id) if eq.question_id is not None else None
        questions.append(
            ExamQuestionRead(
                position=eq.position,
                subject_group=eq.subject_group,
                question_id=eq.question_id,
                subject=source.subject if source else None,
                number=source.number if source else None,
                question_text=source.question_text if source else None,
                question_images=[QuestionImage.model_validate(i) for i in source.question_images]
                if source
                else [],
                answer_text=eq.answer_text,
                official_answer=source.answer_text if source and revealed else None,
                official_answer_images=(
                    [QuestionImage.model_validate(i) for i in source.answer_images]
                    if source and revealed
                    else []
                ),
                outcome=eq.outcome,
                points=points(eq),
            )
        )
    completed = status(attempt) == "completed"
    return ExamRead(
        **summary_fields(attempt),
        deadline_at=attempt.deadline_at,
        server_now=now(),
        group_scores=group_scores([attempt]) if completed else None,
        questions=questions,
    )
