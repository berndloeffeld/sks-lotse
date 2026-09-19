from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FocusTopic(Base):
    """A topic the learner marked as "Fokus" (docs/adr/0028-...).

    Removed again by DELETE /progress/focus/... or automatically once every
    question of the topic is "gelernt" (app/services/focus.py).
    """

    __tablename__ = "focus_topics"
    __table_args__ = (UniqueConstraint("user_id", "topic_id", name="uq_focus_topics_user_id_topic_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
