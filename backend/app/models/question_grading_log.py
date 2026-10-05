from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class QuestionGradingLog(Base):
    """One row per grading of a question, with the half-life it resulted in (docs/adr/0051-...).

    QuestionProgress only keeps the current state; this is the history the admin sees per question.
    Written by services/progress.py next to apply_grading(); deleted with the account.
    """

    __tablename__ = "question_grading_log"
    __table_args__ = (
        Index("ix_question_grading_log_question_id_graded_at", "question_id", "graded_at"),
        # The daily KPI report counts gradings in a time window across all questions.
        Index("ix_question_grading_log_graded_at", "graded_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    graded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # QuestionProgress.half_life_days right after this grading.
    half_life_days: Mapped[float] = mapped_column(Float, nullable=False)
