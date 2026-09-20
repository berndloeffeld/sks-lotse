from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ExamAttempt(Base):
    """One run of the exam simulation (docs/adr/0029-exam-simulation.md).

    The status is derived, not stored: `submitted_at` NULL = in progress,
    then `graded_at` NULL = self-assessment pending, else completed.
    """

    __tablename__ = "exam_attempts"
    __table_args__ = (
        Index("ix_exam_attempts_user_id_started_at", "user_id", "started_at"),
        # At most one running exam per learner, enforced by the database so two
        # parallel starts can't both pass the application-level check.
        Index(
            "uq_exam_attempts_one_in_progress_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("submitted_at IS NULL"),
            sqlite_where=text("submitted_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Snapshot: the learner may switch variants later, the exam keeps its own.
    exam_variant: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    timed_out: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    questions: Mapped[list["ExamAttemptQuestion"]] = relationship(
        order_by="ExamAttemptQuestion.position", lazy="selectin"
    )


class ExamAttemptQuestion(Base):
    __tablename__ = "exam_attempt_questions"
    __table_args__ = (
        UniqueConstraint("attempt_id", "position", name="uq_exam_attempt_questions_attempt_id_position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False
    )
    # SET NULL: a question that vanishes from the catalog must not delete history.
    question_id: Mapped[int | None] = mapped_column(ForeignKey("questions.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    # navigation / schifffahrtsrecht / wetterkunde / seemannschaft (app/core/exam.py)
    subject_group: Mapped[str] = mapped_column(String(32), nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str | None] = mapped_column(String(32))
