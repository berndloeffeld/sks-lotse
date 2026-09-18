from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("subject", "slug", name="uq_topic_subject_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject: Mapped[str] = mapped_column(String(64), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
