from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ChartAttempt(Base):
    """One run through a Kartenaufgabe (docs/adr/0052-chart-exercises-from-reviewed-yaml.md).

    The exercise itself is not a table: `exercise_number` points into the committed
    app/data/chart_exercises.yaml. `completed_at` NULL = still being worked on.
    """

    __tablename__ = "chart_attempts"
    __table_args__ = (
        Index("ix_chart_attempts_user_id_started_at", "user_id", "started_at"),
        # At most one open run per learner and exercise, enforced by the database so two
        # parallel starts can't both pass the application-level check.
        Index(
            "uq_chart_attempts_one_open_per_user_exercise",
            "user_id",
            "exercise_number",
            unique=True,
            postgresql_where=text("completed_at IS NULL"),
            sqlite_where=text("completed_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    exercise_number: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tasks: Mapped[list["ChartAttemptTask"]] = relationship(
        order_by="ChartAttemptTask.task_number", lazy="selectin", cascade="all, delete-orphan"
    )


class ChartAttemptTask(Base):
    """The learner's answer to one task of the run, and the points they gave themselves.

    Created when the task is answered; `points_awarded` NULL = answered, not yet assessed.
    """

    __tablename__ = "chart_attempt_tasks"
    __table_args__ = (
        UniqueConstraint("attempt_id", "task_number", name="uq_chart_attempt_tasks_attempt_id_task_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("chart_attempts.id", ondelete="CASCADE"), nullable=False
    )
    task_number: Mapped[int] = mapped_column(Integer, nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    points_awarded: Mapped[int | None] = mapped_column(Integer)
