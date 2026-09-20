from sqlalchemy import JSON, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.topic import Topic


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (UniqueConstraint("subject", "number", name="uq_question_subject_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject: Mapped[str] = mapped_column(String(64), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Charts/sketches from the catalog PDF, as [{"src", "width", "height"}] — `src` a file name in
    # frontend/public/catalog/ (see ADR-0033). One list for the question, one for its official answer.
    question_images: Mapped[list[dict]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    answer_images: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL", name="fk_questions_topic_id"), nullable=True
    )
    # Only set for subject in {seemannschaft_allgemein, seemannschaft_motor, seemannschaft_segeln} —
    # the original "Nummer N" this question had in the official Seemannschaft I / II catalog before
    # merge_seemannschaft.py collapsed the two into three subjects (see CLAUDE.md → Question Catalog).
    # A seemannschaft_allgemein row (merged duplicate) has both set; segeln/motor rows have only one.
    seemannschaft_1_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seemannschaft_2_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    topic: Mapped[Topic | None] = relationship("Topic")
