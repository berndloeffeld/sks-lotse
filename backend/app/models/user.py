from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core import ai_quota
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Every issued access token embeds the token_version it was minted with
    # (see app/core/jwt.py); get_current_user rejects a token whose embedded
    # version doesn't match the user's current one. Logout increments this,
    # invalidating every previously issued token for the user at once — a
    # counter sidesteps clock-precision issues a timestamp comparison would
    # have (JWT `iat` is whole-second, a DB timestamp isn't).
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # Which SKS exam variant the learner is preparing for — "motor" or "segeln_und_motor"
    # (see app/core/exam_variant.py). NULL until the learner picks one; questions.py falls back to
    # showing every subject when unset.
    exam_variant: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # All optional, self-reported, blank ("keine Angabe") by default. gender is
    # validated against a fixed set at the Pydantic layer (see GenderField in
    # app/schemas/auth.py) rather than a DB enum/CHECK constraint — same
    # reasoning as exam_variant above.
    first_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Entitlement "AI answer check unlocked" (ADR-0031). Flipped by hand until payment exists.
    ai_grading_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    # Entitlement "ads removed" — flipped by hand until payment exists. Hides the UI's ad elements; the
    # AdSense script in the frontend's <head> stays (ADR-0027).
    ads_removed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    # Today's AI-check budget (app/core/ai_quota.py): `ai_checks_used` counts on `ai_checks_day` only;
    # on any other day the budget is full again.
    ai_checks_day: Mapped[date | None] = mapped_column(Date, nullable=True)
    ai_checks_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    @property
    def ai_checks_remaining(self) -> int:
        return ai_quota.remaining(self.ai_checks_day, self.ai_checks_used)
