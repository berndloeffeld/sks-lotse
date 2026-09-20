from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

REPORT_CATEGORIES = ("question_text", "answer_text", "typo", "missing_image", "other")
MAX_COMMENT_LENGTH = 1000


def _require_known_category(value: str) -> str:
    if value not in REPORT_CATEGORIES:
        raise ValueError(f"category must be one of: {', '.join(REPORT_CATEGORIES)}")
    return value


# Validated here rather than typed as a Literal — see GradingOutcomeField in
# app/schemas/progress.py (an enum makes the generated Postman collection non-deterministic).
ReportCategoryField = Annotated[str, AfterValidator(_require_known_category)]


class QuestionReportCreate(BaseModel):
    category: ReportCategoryField
    comment: str | None = Field(default=None, max_length=MAX_COMMENT_LENGTH)

    @field_validator("comment")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class QuestionReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int
    category: str
    comment: str | None
    created_at: datetime
