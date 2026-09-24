from pydantic import BaseModel, Field, field_validator

from app.core.config import settings


class AiGradeRequest(BaseModel):
    answer: str = Field(max_length=settings.grading_max_answer_chars)

    @field_validator("answer")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("answer must not be blank")
        return value


class AiGradeRead(BaseModel):
    # A plain str, not the GradingOutcome Literal — see GradingOutcomeField in app/schemas/progress.py.
    outcome: str
    feedback: str
    # Checks left this week after this one — the learner sees it under the Lotse button.
    remaining_this_week: int
    # Tokens left in the account's balance after this one (ADR-0043).
    tokens_remaining: int
