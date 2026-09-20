from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class QuestionReport(Base):
    """A learner's "Frage melden" note about a catalog question (docs/adr/0030-...).

    Written by POST /questions/{id}/report, read by the operator via
    GET /admin/question-reports. Deleted with the account.
    """

    __tablename__ = "question_reports"
    __table_args__ = (Index("ix_question_reports_question_id", "question_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    # One of REPORT_CATEGORIES (app/schemas/question_report.py).
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
