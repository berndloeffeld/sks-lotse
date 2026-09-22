from datetime import datetime

from pydantic import BaseModel


class GrowthKpis(BaseModel):
    users_total: int
    new_24h: int
    new_previous_24h: int
    new_7d: int
    variant_motor: int
    variant_segeln_und_motor: int
    variant_unset: int
    # Of the accounts created in the last 7 days: share with at least one
    # graded question. None when nobody signed up.
    activation_rate_7d: float | None


class EngagementKpis(BaseModel):
    dau: int
    dau_previous: int
    wau: int
    mau: int
    # dau / mau; None while there is no monthly activity.
    stickiness: float | None
    # Accounts created 7-14 days ago that were active again in the last 7 days.
    retention_cohort_size: int
    retention_rate: float | None
    ratings_24h: int
    ratings_per_active_user_24h: float | None


class SubjectLearned(BaseModel):
    subject: str
    learned_questions: int


class LearningKpis(BaseModel):
    learners: int
    learned_questions_total: int
    learned_per_learner: float | None
    # A list, not a dict: the generated Postman example for a free-form dict
    # has a random number of keys, which would make the committed collection flaky.
    learned_by_subject: list[SubjectLearned]
    focus_users: int
    exams_started_24h: int
    exams_submitted_24h: int
    exams_timed_out_24h: int
    exams_graded_7d: int
    exams_passed_7d: int


class ReportedQuestion(BaseModel):
    subject: str
    number: int
    reports: int


class QualityKpis(BaseModel):
    reports_24h: int
    reports_total: int
    top_reported_7d: list[ReportedQuestion]
    # AI-grading abuse signal (ADR-0040): accounts newly flagged in the last 24h, and the
    # cumulative flag count across all accounts — never any per-account or answer detail.
    ai_flags_24h: int
    ai_flags_total: int


class KpiReport(BaseModel):
    """Aggregates only — no per-learner data, safe to mail (see docs/adr/0032-...)."""

    generated_at: datetime
    growth: GrowthKpis
    engagement: EngagementKpis
    learning: LearningKpis
    quality: QualityKpis
