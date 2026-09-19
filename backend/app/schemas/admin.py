from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import NormalizedEmail


class AdminUserSearchRequest(BaseModel):
    email: NormalizedEmail


class AdminUserRead(BaseModel):
    # Doubles as the "user" part of the Art. 15/20 DSGVO export below, so it
    # has to cover every personal-data column on User — add new ones here.
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime
    exam_variant: str | None
    first_name: str | None
    last_name: str | None
    gender: str | None
    question_progress_count: int


class AdminQuestionProgressExport(BaseModel):
    question_id: int
    subject: str
    question_number: int
    correct_streak: int
    created_at: datetime
    updated_at: datetime


class AdminFocusTopicExport(BaseModel):
    subject: str
    topic_slug: str
    topic_name: str
    created_at: datetime


class AdminUserExport(BaseModel):
    user: AdminUserRead
    question_progress: list[AdminQuestionProgressExport]
    focus_topics: list[AdminFocusTopicExport]
    exported_at: datetime
