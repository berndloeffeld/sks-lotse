from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
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
