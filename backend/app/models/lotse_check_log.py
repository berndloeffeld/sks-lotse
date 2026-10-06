from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LotseCheckLog(Base):
    """One row per Lotsen-Check that ran, for the daily KPI report (ADR-0032 addendum 2026-10-05).

    Deliberately without a user: it counts checks and the tokens they cost, nothing about who asked
    or what, so it is no personal data and survives an account deletion. The
    report looks back 7 days; the daily report job deletes rows older than 30 days
    (`lotse_check.purge_check_log`, `CHECK_LOG_RETENTION`).
    """

    __tablename__ = "lotse_check_log"
    __table_args__ = (Index("ix_lotse_check_log_checked_at", "checked_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # "catalog" (a question of the catalog) | "chart" (a Kartenaufgabe task)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
