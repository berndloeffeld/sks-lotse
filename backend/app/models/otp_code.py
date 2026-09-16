from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class OtpCode(Base):
    __tablename__ = "otp_codes"
    # Every /auth/otp/request call runs two email-scoped reads (recent-request
    # count, latest code) — a composite index makes both an index-only lookup
    # instead of an email-index scan followed by a sort. Replaces a plain
    # single-column index on `email`: that would be a redundant subset of this
    # one (a composite index already serves an email-only equality lookup via
    # its leftmost column).
    __table_args__ = (Index("ix_otp_codes_email_created_at", "email", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
