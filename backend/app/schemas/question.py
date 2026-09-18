from pydantic import BaseModel, ConfigDict, field_validator


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    number: int
    question_text: str
    answer_text: str
    image_ref: str | None
    topic: str | None = None

    @field_validator("topic", mode="before")
    @classmethod
    def _topic_slug(cls, value: object) -> str | None:
        # `Question.topic` is a Topic ORM object (or None) via the relationship —
        # reduce it to its slug, which is all API consumers need.
        return value if value is None or isinstance(value, str) else value.slug


class TopicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subject: str
    slug: str
    name: str
    display_order: int
