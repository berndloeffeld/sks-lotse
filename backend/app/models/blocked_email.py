from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BlockedEmail(Base):
    """A manually blocked address or domain (app/services/blocklist.py).

    Separate from ALLOWED_EMAILS/ADMIN_EMAILS (operator-set env vars, changed via a Render
    redeploy, ADR-0019): this list is edited at runtime from /admin and must be able to name an
    address that has no User row yet, so it needs its own table rather than a settings string.
    """

    __tablename__ = "blocked_emails"
    __table_args__ = (
        # One admin click ("block this user") or one manual add must be idempotent, and the
        # hot-path lookup (blocklist.is_email_blocked) reads the whole table anyway, so this is
        # about uniqueness, not a read pattern to optimize for.
        Index("ix_blocked_emails_kind_value", "kind", "value", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # "email" (an exact, canonicalized address) or "domain" (lowercased, no "@").
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # The admin's email, for the audit trail — never logged by _audit itself (app/api/v1/admin.py),
    # only stored here where an admin who already knows the address can look it up.
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
