from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, false, func
from sqlalchemy.orm import Mapped, mapped_column

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
    # Pay-per-use balance for the AI answer check (ADR-0043, superseding the old boolean
    # ai_grading_enabled entitlement): 1 token = 1 check. Credited by the signup bonus and by
    # admin grants (app/services/token_wallet.py) until a real payment provider is wired up.
    token_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # Entitlement "ads removed" — flipped by hand until payment exists. Hides the UI's ad elements; the
    # AdSense script in the frontend's <head> stays (ADR-0027).
    ads_removed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    # How often the sanitizer backstop (app/services/grader.py) fired for this account — a signal
    # for prompt-injection abuse, never the triggering text itself (ADR-0031, ADR-0040).
    ai_flags_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    ai_flags_last_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Which AGB version this account last confirmed, and when — set only by
    # POST /auth/me/agb-accept (app/api/v1/auth.py), never on login itself.
    # NULL until the first confirmation. See ADR-0041.
    agb_accepted_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    agb_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set on every successful login (app/api/v1/auth.py::verify_otp). Exists
    # solely for a future inactivity-based retention policy (ADR-0041) — ADR-0032
    # deliberately does not use it for KPI activity, to keep that definition
    # purely learning-based. Indexed for the future cleanup job's
    # `last_login_at < cutoff` scan.
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
