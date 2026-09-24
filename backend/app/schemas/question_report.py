from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import one_of

REPORT_CATEGORIES = ("question_text", "answer_text", "typo", "missing_image", "other")
MAX_COMMENT_LENGTH = 1000


ReportCategoryField = Annotated[str, one_of("category", REPORT_CATEGORIES)]


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
