from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import NormalizedEmail


class AdminUserSearchRequest(BaseModel):
    email: NormalizedEmail


class AdminUserUpdate(BaseModel):
    ai_grading_enabled: bool


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
    ai_grading_enabled: bool
    ai_checks_day: date | None
    ai_checks_used: int
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


class AdminQuestionReportExport(BaseModel):
    question_id: int
    subject: str
    question_number: int
    category: str
    comment: str | None
    created_at: datetime


class AdminQuestionReportRead(AdminQuestionReportExport):
    # The reporting account, so the operator can reply — only ever shown to admins.
    user_id: int
    user_email: str


class AdminExamQuestionExport(BaseModel):
    position: int
    subject_group: str
    # None if the question has since vanished from the catalog.
    subject: str | None
    question_number: int | None
    answer_text: str | None
    outcome: str | None


class AdminExamAttemptExport(BaseModel):
    exam_id: int
    exam_variant: str
    started_at: datetime
    deadline_at: datetime
    submitted_at: datetime | None
    graded_at: datetime | None
    timed_out: bool
    questions: list[AdminExamQuestionExport]


class AdminUserExport(BaseModel):
    user: AdminUserRead
    question_progress: list[AdminQuestionProgressExport]
    focus_topics: list[AdminFocusTopicExport]
    question_reports: list[AdminQuestionReportExport]
    exam_attempts: list[AdminExamAttemptExport]
    exported_at: datetime
