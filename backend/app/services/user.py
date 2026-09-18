from sqlalchemy import delete
from sqlalchemy.orm import Session

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
    # Pending/recent codes for the address are personal data too. The regular
    # cleanup (ADR-0010) only runs opportunistically on later OTP requests, so
    # it can't be relied on to remove them promptly after an erasure request.
    db.execute(delete(OtpCode).where(OtpCode.email == user.email))
    db.delete(user)
    db.commit()
