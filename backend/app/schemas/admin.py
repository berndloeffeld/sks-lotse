from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_WEEKLY_LIMIT = 10_000
MAX_GRANT_TOKENS = 100_000
MAX_GRANT_AMOUNT_EUR_CENTS = 1_000_000
MAX_PRICE_CENTS = 1_000_000
MAX_PACKAGE_TOKENS = 100_000


class AdminUserUpdate(BaseModel):
    ads_removed: bool | None = None
    # Explicit null resets the account to the app-wide default; "absent" is told apart via model_fields_set.
    ai_checks_weekly_limit: int | None = Field(default=None, ge=0, le=MAX_WEEKLY_LIMIT)
    # A manual token top-up (ADR-0043) — off-platform payment until a payment provider exists.
    # Optional: how much the account actually paid for it, so it's kept (anonymized) rather than
    # deleted on account deletion, like a real purchase (see services/user.py). None for a
    # goodwill grant with no payment behind it.
    grant_tokens: int | None = Field(default=None, ge=1, le=MAX_GRANT_TOKENS)
    grant_amount_eur_cents: int | None = Field(default=None, ge=0, le=MAX_GRANT_AMOUNT_EUR_CENTS)

    @model_validator(mode="after")
    def _require_a_field(self) -> "AdminUserUpdate":
        if (
            self.ads_removed is None
            and "ai_checks_weekly_limit" not in self.model_fields_set
            and self.grant_tokens is None
        ):
            raise ValueError("at least one of ads_removed, ai_checks_weekly_limit, grant_tokens required")
        return self


class TokenPackageSettings(BaseModel):
    tokens: int = Field(ge=1, le=MAX_PACKAGE_TOKENS)
    price_cents: int = Field(ge=0, le=MAX_PRICE_CENTS)


class AdminSettingsRead(BaseModel):
    ai_checks_weekly_default: int
    price_ads_removed_cents: int
    signup_bonus_tokens: int
    tokens_s: TokenPackageSettings
    tokens_m: TokenPackageSettings
    tokens_l: TokenPackageSettings
    tokens_xl: TokenPackageSettings


class AdminSettingsUpdate(BaseModel):
    ai_checks_weekly_default: int = Field(ge=0, le=MAX_WEEKLY_LIMIT)
    price_ads_removed_cents: int = Field(ge=0, le=MAX_PRICE_CENTS)
    signup_bonus_tokens: int = Field(ge=0, le=1_000)
    tokens_s: TokenPackageSettings
    tokens_m: TokenPackageSettings
    tokens_l: TokenPackageSettings
    tokens_xl: TokenPackageSettings


class AdminUserListItem(BaseModel):
    # One row of the admin user list — just what the table shows; the detail is AdminUserRead.
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str | None
    last_name: str | None
    created_at: datetime
    token_balance: int
    ads_removed: bool


class AdminUserListPage(BaseModel):
    items: list[AdminUserListItem]
    total: int  # matches for the search, across all pages


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
    token_balance: int
    ads_removed: bool
    ai_checks_week: date | None
    ai_checks_used: int
    ai_checks_weekly_limit: int | None  # the account's override; null = the app-wide default
    ai_checks_limit: int  # what actually applies to the account this week
    # Read-only diagnostic signal (ADR-0040): how often the sanitizer backstop fired for this
    # account. No admin control to reset it — it's a symptom to investigate, not an entitlement.
    ai_flags_count: int
    ai_flags_last_at: datetime | None
    agb_accepted_version: str | None
    agb_accepted_at: datetime | None
    last_login_at: datetime | None
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


class AdminPurchaseExport(BaseModel):
    # Never NULL here: a row this account's own export can see still has its user_id set — an
    # anonymized row (services/user.py) only exists after that same account is already gone.
    product: str
    tokens_granted: int | None
    amount_eur_cents: int | None
    granted_by: str
    created_at: datetime


class AdminUserExport(BaseModel):
    user: AdminUserRead
    question_progress: list[AdminQuestionProgressExport]
    focus_topics: list[AdminFocusTopicExport]
    question_reports: list[AdminQuestionReportExport]
    exam_attempts: list[AdminExamAttemptExport]
    purchases: list[AdminPurchaseExport]
    exported_at: datetime
