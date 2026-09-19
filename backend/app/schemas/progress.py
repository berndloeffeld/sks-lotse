from typing import Annotated, get_args

from pydantic import AfterValidator, BaseModel

from app.core.progress import GradingOutcome

_OUTCOMES = get_args(GradingOutcome)


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


def _require_known_outcome(value: str) -> str:
    if value not in _OUTCOMES:
        raise ValueError(f"outcome must be one of: {', '.join(_OUTCOMES)}")
    return value


# Validated here rather than typed as the GradingOutcome Literal: an enum in
# the OpenAPI schema makes openapi-to-postmanv2 pick a random member as the
# example on every run, breaking the committed-collection CI check (same
# reasoning as ExamVariantField in app/schemas/auth.py).
GradingOutcomeField = Annotated[str, AfterValidator(_require_known_outcome)]


class QuestionGradeCreate(BaseModel):
    outcome: GradingOutcomeField
