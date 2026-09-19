from pydantic import BaseModel

from app.core.progress import GradingOutcome


class TopicProgressRead(BaseModel):
    subject: str
    topic_slug: str
    topic_name: str
    display_order: int
    total_questions: int
    learned_questions: int


class QuestionProgressRead(BaseModel):
    question_id: int
    correct_streak: int
    learned: bool


class QuestionGradeCreate(BaseModel):
    outcome: GradingOutcome
