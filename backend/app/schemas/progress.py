from pydantic import BaseModel


class TopicProgressRead(BaseModel):
    subject: str
    topic_slug: str
    topic_name: str
    display_order: int
    total_questions: int
    learned_questions: int
