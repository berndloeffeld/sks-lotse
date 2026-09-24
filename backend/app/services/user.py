from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.focus_topic import FocusTopic
from app.models.otp_code import OtpCode
from app.models.purchase import Purchase
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
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
    db.execute(delete(QuestionReport).where(QuestionReport.user_id == user.id))
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
    # Purchases tied to real money (Werbefrei, Token-Pakete) are kept for the statutory bookkeeping
    # retention period (§147 AO/§257 HGB can forbid deleting payment records) but anonymized: the
    # account link is severed, the product/amount/date stay. Grants that involved no money (the
    # signup bonus, a goodwill admin correction) carry no such obligation and are deleted normally,
    # like the rest of the account's data. See ADR-0043 — not legal advice, review with counsel.
    db.execute(
        update(Purchase)
        .where(Purchase.user_id == user.id, Purchase.amount_eur_cents.is_not(None))
        .values(user_id=None)
    )
    db.execute(delete(Purchase).where(Purchase.user_id == user.id, Purchase.amount_eur_cents.is_(None)))
    # This account may itself be the admin who granted other users' purchases — sever that
    # reference too (the granting admin's identity isn't personal data worth keeping for its
    # own sake, and the FK would otherwise block deleting this row).
    db.execute(update(Purchase).where(Purchase.admin_user_id == user.id).values(admin_user_id=None))
    db.delete(user)
    db.commit()
