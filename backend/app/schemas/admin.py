from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import NormalizedEmail


class AdminUserSearchRequest(BaseModel):
    email: NormalizedEmail


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime
    exam_variant: str | None
    question_progress_count: int


class AdminQuestionProgressExport(BaseModel):
    question_id: int
    subject: str
    question_number: int
    correct_streak: int
    created_at: datetime
    updated_at: datetime


class AdminUserExport(BaseModel):
    user: AdminUserRead
    question_progress: list[AdminQuestionProgressExport]
    exported_at: datetime
