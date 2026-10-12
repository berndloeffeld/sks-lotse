from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel


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
    chart_attempts_started_24h: int
    chart_attempts_completed_24h: int


class MonetizationKpis(BaseModel):
    # Lotsen-Checks that ran (a failed one is refunded and not counted), by kind, and their tokens.
    lotse_checks_catalog_24h: int
    lotse_checks_chart_24h: int
    tokens_spent_24h: int
    tokens_spent_7d: int
    # Stripe purchases only (purchases.granted_by = "stripe"); revenue in euro cents, gross.
    purchases_24h: int
    purchases_7d: int
    revenue_cents_24h: int
    revenue_cents_7d: int


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
    monetization: MonetizationKpis


# The ranges the admin dashboard offers; anything else is a 422.
DASHBOARD_DAYS = (7, 30, 90)


def _dashboard_days(value: int) -> int:
    if value not in DASHBOARD_DAYS:
        raise ValueError(f"days must be one of: {', '.join(map(str, DASHBOARD_DAYS))}")
    return value


# A plain int, not an IntEnum: an OpenAPI enum gets a random Postman example (see schemas/common.py).
DashboardDays = Annotated[int, AfterValidator(_dashboard_days)]


class DailyKpis(BaseModel):
    """One UTC day of the admin dashboard; same definitions as the report's figures."""

    day: date
    new_users: int
    # Distinct learners with a grading, a started exam or an answered Kartenaufgabe task that day.
    active_users: int
    ratings: int
    # From lotse_check_log, which keeps 30 days: older days read 0.
    lotse_checks_catalog: int
    lotse_checks_chart: int
    tokens_spent: int
    # Stripe only, gross euro cents, as in MonetizationKpis.
    purchases: int
    revenue_cents: int


class AdminDashboard(BaseModel):
    """The admin overview page: aggregates only, like the KpiReport it shares its sections with."""

    generated_at: datetime
    days: int
    growth: GrowthKpis
    engagement: EngagementKpis
    monetization: MonetizationKpis
    # Oldest day first, exactly `days` rows, today (so far) last.
    daily: list[DailyKpis]
