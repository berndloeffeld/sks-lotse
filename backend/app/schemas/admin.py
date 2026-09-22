from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.auth import NormalizedEmail

MAX_WEEKLY_LIMIT = 10_000


class AdminUserSearchRequest(BaseModel):
    email: NormalizedEmail


class AdminUserUpdate(BaseModel):
    ai_grading_enabled: bool | None = None
    ads_removed: bool | None = None
    # Explicit null resets the account to the app-wide default; "absent" is told apart via model_fields_set.
    ai_checks_weekly_limit: int | None = Field(default=None, ge=0, le=MAX_WEEKLY_LIMIT)

    @model_validator(mode="after")
    def _require_a_field(self) -> "AdminUserUpdate":
        if (
            self.ai_grading_enabled is None
            and self.ads_removed is None
            and "ai_checks_weekly_limit" not in self.model_fields_set
        ):
            raise ValueError(
                "at least one of ai_grading_enabled, ads_removed, ai_checks_weekly_limit required"
            )
        return self


class AdminSettingsRead(BaseModel):
    ai_checks_weekly_default: int


class AdminSettingsUpdate(BaseModel):
    ai_checks_weekly_default: int = Field(ge=0, le=MAX_WEEKLY_LIMIT)


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
    ads_removed: bool
    ai_checks_week: date | None
    ai_checks_used: int
    ai_checks_weekly_limit: int | None  # the account's override; null = the app-wide default
    ai_checks_limit: int  # what actually applies to the account this week
    question_progress_count: int


class AdminQuestionProgressExport(BaseModel):
    question_id: int
    subject: str
    question_number: int
    half_life_days: float
    last_graded_at: datetime
    last_correct_at: datetime | None
    streak_start_at: datetime | None
    review_due_at: datetime
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
