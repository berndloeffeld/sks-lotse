from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class QuestionProgress(Base):
    __tablename__ = "question_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_question_progress_user_id_question_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    # Estimated memory half-life in days, re-estimated by every grading — see
    # app/core/progress.py and docs/adr/0034-... Written by
    # POST /api/v1/progress/questions/{id} (self-assessment, docs/adr/0023-...).
    half_life_days: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1")
    last_graded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # When the question was last graded "Richtig" (NULL: never). Orders the Fokus session
    # oldest-correct-first (docs/adr/0028-...). Set by apply_grading().
    last_correct_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Start of the current unbroken "Richtig" streak (NULL: no streak in progress — the last
    # grading, if any, wasn't "Richtig"). Reset to NULL by Teilweise/Falsch, set by the streak's
    # first "Richtig", unchanged by the ones after — see app/core/progress.py and docs/adr/0039-...
    streak_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # last_graded_at + the time until recall probability falls to RECALL_THRESHOLD.
    # Stored (not derived) so "gelernt" is a plain SQL filter on half_life_days.
    review_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
