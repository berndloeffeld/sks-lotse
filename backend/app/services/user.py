from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.focus_topic import FocusTopic
from app.models.otp_code import OtpCode
from app.models.question_progress import QuestionProgress
from app.models.user import User


def delete_user_and_progress(db: Session, user: User) -> None:
    # Deleted explicitly rather than relying on the question_progress.user_id
    # FK's ondelete="CASCADE": that fires reliably on Postgres (production),
    # but SQLite (used by the test suite) only enforces FK actions when
    # PRAGMA foreign_keys=ON is set on the connection, which app/core/database.py
    # doesn't do — an ORM-level session.delete(user) alone can't be trusted to
    # cascade under both engines.
    db.execute(delete(QuestionProgress).where(QuestionProgress.user_id == user.id))
    db.execute(delete(FocusTopic).where(FocusTopic.user_id == user.id))
    # Exam attempts carry the learner's free-text answers; their questions go first.
    attempt_ids = select(ExamAttempt.id).where(ExamAttempt.user_id == user.id)
    db.execute(delete(ExamAttemptQuestion).where(ExamAttemptQuestion.attempt_id.in_(attempt_ids)))
    db.execute(delete(ExamAttempt).where(ExamAttempt.user_id == user.id))
    # Pending/recent codes are personal data too — both those for the
    # account's own address and email-change codes it requested for another
    # one. The regular cleanup (ADR-0010) only runs opportunistically on later
    # OTP requests, so it can't be relied on to remove them promptly after an
    # erasure request. (user_id's FK cascade would cover the latter on
    # Postgres, but not on SQLite — same reasoning as above.)
    db.execute(delete(OtpCode).where(or_(OtpCode.email == user.email, OtpCode.user_id == user.id)))
    db.delete(user)
    db.commit()
