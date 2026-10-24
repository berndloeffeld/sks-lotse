from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SbfNavigationAttempt(Base):
    """One run through an SBF Navigationsaufgabe See, with an account (ADR-0071).

    The task itself is not a table: `task_number` points into the committed
    app/data/sbf_navigation.yaml (ADR-0068). `completed_at` NULL = still being worked on. Its own
    table rather than chart_attempts: one point per subtask, follow-on errors count as correct, and
    none of SKS Lotse's queries on the Kartenaufgaben has to tell the two apart.
    """

    __tablename__ = "sbf_navigation_attempts"
    __table_args__ = (
        Index("ix_sbf_navigation_attempts_user_id_started_at", "user_id", "started_at"),
        # At most one open run per learner and task, enforced by the database so two parallel
        # starts can't both pass the application-level check.
        Index(
            "uq_sbf_navigation_attempts_one_open_per_user_task",
            "user_id",
            "task_number",
            unique=True,
            postgresql_where=text("completed_at IS NULL"),
            sqlite_where=text("completed_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_number: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subtasks: Mapped[list["SbfNavigationAttemptSubtask"]] = relationship(
        order_by="SbfNavigationAttemptSubtask.subtask_number", lazy="selectin", cascade="all, delete-orphan"
    )


class SbfNavigationAttemptSubtask(Base):
    """The learner's answer to one subtask of the run, and the point they gave themselves.

    Created when the subtask is answered; `point` NULL = answered, not yet assessed. The `ai_*`
    columns hold the Lotsen-Check's suggestion (ADR-0071), NULL until the learner asks for one — at
    most one per subtask: the answer can't change once given.
    """

    __tablename__ = "sbf_navigation_attempt_subtasks"
    __table_args__ = (
        UniqueConstraint(
            "attempt_id",
            "subtask_number",
            name="uq_sbf_navigation_subtasks_attempt_subtask",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("sbf_navigation_attempts.id", ondelete="CASCADE"), nullable=False
    )
    subtask_number: Mapped[int] = mapped_column(Integer, nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # 0 or 1 (SpFV Anlage 3 Nr. 1.1: one point per subtask).
    point: Mapped[int | None] = mapped_column(Integer)
    ai_correct: Mapped[bool | None] = mapped_column(Boolean)
    ai_feedback: Mapped[str | None] = mapped_column(Text)
    ai_suspected_error: Mapped[str | None] = mapped_column(Text)
