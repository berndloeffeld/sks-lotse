from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Purchase(Base):
    """A ledger of paid/granted entitlements — tokens, the ads-removed fee, the signup bonus (ADR-0043).

    One row per grant, so a future Stripe webhook writes here the same way a manual admin grant
    does today (`granted_by`). `amount_eur_cents` is NULL for grants that involved no money (the
    signup bonus, a goodwill admin correction) — `services/user.py::delete_user_and_progress` uses
    exactly that to decide whether a row must be anonymized (kept for statutory bookkeeping
    retention, §147 AO/§257 HGB) rather than deleted outright on account deletion.
    """

    __tablename__ = "purchases"
    # Covers both "every purchase of this user" and "...ordered by date" — the only two read
    # patterns so far (admin export, GDPR deletion); a plain user_id index would be a redundant
    # subset of this one.
    __table_args__ = (Index("ix_purchases_user_id_created_at", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NULL once anonymized (see class docstring) — never re-populated afterwards.
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # "ads_removed" | "tokens_s" | "tokens_m" | "tokens_l" | "tokens_xl" | "signup_bonus" | "admin_grant"
    product: Mapped[str] = mapped_column(String(32), nullable=False)
    tokens_granted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount_eur_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # "signup" | "admin_manual" | (future) "stripe"
    granted_by: Mapped[str] = mapped_column(String(32), nullable=False)
    admin_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
