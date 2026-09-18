from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class OtpCode(Base):
    __tablename__ = "otp_codes"
    __table_args__ = (
        # Every /auth/otp/request call runs two email-scoped reads (recent-request
        # count, latest code) — a composite index makes both an index-only lookup
        # instead of an email-index scan followed by a sort. Replaces a plain
        # single-column index on `email`: that would be a redundant subset of this
        # one (a composite index already serves an email-only equality lookup via
        # its leftmost column). Both reads also filter on `purpose`, deliberately
        # left out of the index: the per-address hourly cap bounds the rows per
        # email to a handful, so filtering those in place costs nothing.
        Index("ix_otp_codes_email_created_at", "email", "created_at"),
        # The cleanup sweep (backend/app/api/v1/auth.py, _cleanup_expired_otp_codes)
        # filters on expires_at alone, with no email predicate — the composite
        # index above can't help it, since email is neither filtered nor its
        # leftmost column here.
        Index("ix_otp_codes_expires_at", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # OTP_PURPOSE_LOGIN or OTP_PURPOSE_EMAIL_CHANGE (app/core/otp.py). No
    # default: every insert has to say which flow the code belongs to.
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    # Only set for OTP_PURPOSE_EMAIL_CHANGE: the account that asked to move to
    # `email`. Binds the code to that account (no one else can redeem it or
    # burn its attempts) and lets an account deletion remove pending codes
    # for addresses other than the account's own. Deliberately unindexed:
    # nothing looks codes up by user_id alone except that rare deletion,
    # and the table stays small (see the cleanup in ADR-0010).
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE", name="fk_otp_codes_user_id_users"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
