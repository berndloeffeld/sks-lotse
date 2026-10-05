from datetime import datetime, timedelta

from sqlalchemy import distinct, exists, func, select, union
from sqlalchemy.orm import Session

from app.domain.exam import result_for
from app.domain.progress import learned_clause
from app.models.chart_attempt import ChartAttempt, ChartAttemptTask
from app.models.exam_attempt import ExamAttempt
from app.models.focus_topic import FocusTopic
from app.models.lotse_check_log import LotseCheckLog
from app.models.purchase import Purchase
from app.models.question import Question
from app.models.question_grading_log import QuestionGradingLog
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.user import User
from app.schemas.kpis import (
    EngagementKpis,
    GrowthKpis,
    KpiReport,
    LearningKpis,
    MonetizationKpis,
    QualityKpis,
    ReportedQuestion,
    SubjectLearned,
)
from app.services import exam as exam_service

TOP_REPORTED_LIMIT = 5


def _ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def _count(db: Session, query) -> int:
    return db.execute(select(func.count()).select_from(query.subquery())).scalar_one()


def _active_user_ids(since: datetime, until: datetime):
    """Learners with a graded question, an answered Kartenaufgabe task or a started exam in [since, until)."""
    graded = select(QuestionProgress.user_id).where(
        QuestionProgress.updated_at >= since, QuestionProgress.updated_at < until
    )
    started = select(ExamAttempt.user_id).where(
        ExamAttempt.started_at >= since, ExamAttempt.started_at < until
    )
    charted = (
        select(ChartAttempt.user_id)
        .join(ChartAttemptTask, ChartAttemptTask.attempt_id == ChartAttempt.id)
        .where(ChartAttemptTask.answered_at >= since, ChartAttemptTask.answered_at < until)
    )
    return union(graded, started, charted)


def _active_users(db: Session, since: datetime, until: datetime) -> int:
    return _count(db, _active_user_ids(since, until))


def _users_created(db: Session, since: datetime, until: datetime) -> int:
    return db.execute(
        select(func.count()).select_from(User).where(User.created_at >= since, User.created_at < until)
    ).scalar_one()


def _growth(db: Session, now: datetime) -> GrowthKpis:
    day = timedelta(days=1)
    week = 7 * day
    variants: dict[str | None, int] = dict(
        db.execute(select(User.exam_variant, func.count()).group_by(User.exam_variant)).tuples().all()
    )
    recent = select(User.id).where(User.created_at >= now - week)
    has_progress = exists().where(QuestionProgress.user_id == User.id)
    activated = _count(db, recent.where(has_progress))
    return GrowthKpis(
        users_total=sum(variants.values()),
        new_24h=_users_created(db, now - day, now),
        new_previous_24h=_users_created(db, now - 2 * day, now - day),
        new_7d=_users_created(db, now - week, now),
        variant_motor=variants.get("motor", 0),
        variant_segeln_und_motor=variants.get("segeln_und_motor", 0),
        variant_unset=variants.get(None, 0),
        activation_rate_7d=_ratio(activated, _count(db, recent)),
    )


def _engagement(db: Session, now: datetime) -> EngagementKpis:
    day = timedelta(days=1)
    week = 7 * day
    dau = _active_users(db, now - day, now)
    mau = _active_users(db, now - 30 * day, now)
    cohort = select(User.id).where(User.created_at >= now - 2 * week, User.created_at < now - week)
    retained = cohort.where(User.id.in_(_active_user_ids(now - week, now)))
    ratings_24h = db.execute(
        select(func.count()).select_from(QuestionGradingLog).where(QuestionGradingLog.graded_at >= now - day)
    ).scalar_one()
    cohort_size = _count(db, cohort)
    return EngagementKpis(
        dau=dau,
        dau_previous=_active_users(db, now - 2 * day, now - day),
        wau=_active_users(db, now - week, now),
        mau=mau,
        stickiness=_ratio(dau, mau),
        retention_cohort_size=cohort_size,
        retention_rate=_ratio(_count(db, retained), cohort_size),
        ratings_24h=ratings_24h,
        ratings_per_active_user_24h=_ratio(ratings_24h, dau),
    )


def _exams_passed(db: Session, since: datetime) -> tuple[int, int]:
    attempts = db.execute(select(ExamAttempt).where(ExamAttempt.graded_at >= since)).scalars().all()
    passed = sum(1 for attempt in attempts if result_for(exam_service.total_points(attempt)) == "bestanden")
    return len(attempts), passed


def _count_between(db: Session, column, since: datetime, until: datetime) -> int:
    """Rows of the column's table with the column in [since, until)."""
    return db.execute(
        select(func.count()).select_from(column.class_).where(column >= since, column < until)
    ).scalar_one()


def _learning(db: Session, now: datetime) -> LearningKpis:
    day = timedelta(days=1)
    learned = learned_clause(now)
    by_subject = [
        SubjectLearned(subject=subject, learned_questions=count)
        for subject, count in db.execute(
            select(Question.subject, func.count())
            .join(QuestionProgress, QuestionProgress.question_id == Question.id)
            .where(learned)
            .group_by(Question.subject)
            .order_by(Question.subject)
        ).all()
    ]
    learned_total = sum(item.learned_questions for item in by_subject)
    learners = db.execute(select(func.count(distinct(QuestionProgress.user_id)))).scalar_one()
    graded, passed = _exams_passed(db, now - 7 * day)
    return LearningKpis(
        learners=learners,
        learned_questions_total=learned_total,
        learned_per_learner=_ratio(learned_total, learners),
        learned_by_subject=by_subject,
        focus_users=db.execute(select(func.count(distinct(FocusTopic.user_id)))).scalar_one(),
        exams_started_24h=_count_between(db, ExamAttempt.started_at, now - day, now),
        exams_submitted_24h=_count_between(db, ExamAttempt.submitted_at, now - day, now),
        exams_timed_out_24h=db.execute(
            select(func.count())
            .select_from(ExamAttempt)
            .where(ExamAttempt.timed_out, ExamAttempt.started_at >= now - day)
        ).scalar_one(),
        exams_graded_7d=graded,
        exams_passed_7d=passed,
        chart_attempts_started_24h=_count_between(db, ChartAttempt.started_at, now - day, now),
        chart_attempts_completed_24h=_count_between(db, ChartAttempt.completed_at, now - day, now),
    )


def _quality(db: Session, now: datetime) -> QualityKpis:
    top = db.execute(
        select(Question.subject, Question.number, func.count().label("reports"))
        .join(QuestionReport, QuestionReport.question_id == Question.id)
        .where(QuestionReport.created_at >= now - timedelta(days=7))
        .group_by(Question.subject, Question.number)
        .order_by(func.count().desc(), Question.subject, Question.number)
        .limit(TOP_REPORTED_LIMIT)
    ).all()
    return QualityKpis(
        reports_24h=db.execute(
            select(func.count())
            .select_from(QuestionReport)
            .where(QuestionReport.created_at >= now - timedelta(days=1))
        ).scalar_one(),
        reports_total=db.execute(select(func.count()).select_from(QuestionReport)).scalar_one(),
        top_reported_7d=[ReportedQuestion(subject=s, number=n, reports=r) for s, n, r in top],
        ai_flags_24h=db.execute(
            select(func.count())
            .select_from(User)
            .where(User.ai_flags_last_at.is_not(None), User.ai_flags_last_at >= now - timedelta(days=1))
        ).scalar_one(),
        ai_flags_total=db.execute(select(func.coalesce(func.sum(User.ai_flags_count), 0))).scalar_one(),
    )


def _monetization(db: Session, now: datetime) -> MonetizationKpis:
    day = timedelta(days=1)
    week = 7 * day

    def checks(kind: str) -> int:
        return db.execute(
            select(func.count())
            .select_from(LotseCheckLog)
            .where(LotseCheckLog.kind == kind, LotseCheckLog.checked_at >= now - day)
        ).scalar_one()

    def tokens_spent(since: datetime) -> int:
        return db.execute(
            select(func.coalesce(func.sum(LotseCheckLog.tokens), 0)).where(LotseCheckLog.checked_at >= since)
        ).scalar_one()

    def purchases(since: datetime) -> tuple[int, int]:
        count, cents = db.execute(
            select(func.count(), func.coalesce(func.sum(Purchase.amount_eur_cents), 0)).where(
                Purchase.granted_by == "stripe", Purchase.created_at >= since
            )
        ).one()
        return count, cents

    purchases_24h, revenue_24h = purchases(now - day)
    purchases_7d, revenue_7d = purchases(now - week)
    return MonetizationKpis(
        lotse_checks_catalog_24h=checks("catalog"),
        lotse_checks_chart_24h=checks("chart"),
        tokens_spent_24h=tokens_spent(now - day),
        tokens_spent_7d=tokens_spent(now - week),
        purchases_24h=purchases_24h,
        purchases_7d=purchases_7d,
        revenue_cents_24h=revenue_24h,
        revenue_cents_7d=revenue_7d,
    )


def compute_kpis(db: Session, now: datetime) -> KpiReport:
    """Aggregate usage numbers as of `now` (timezone-aware UTC)."""
    return KpiReport(
        generated_at=now,
        growth=_growth(db, now),
        engagement=_engagement(db, now),
        learning=_learning(db, now),
        quality=_quality(db, now),
        monetization=_monetization(db, now),
    )


def _pct(value: float | None) -> str:
    return "-" if value is None else f"{value * 100:.0f} %"


def _eur(cents: int) -> str:
    return f"{cents / 100:.2f} EUR".replace(".", ",")


def _num(value: float | None) -> str:
    return "-" if value is None else f"{value:.1f}"


def format_report(report: KpiReport) -> str:
    """German plain-text rendering of the report, for the daily mail."""
    g, e, learn, q, m = (
        report.growth,
        report.engagement,
        report.learning,
        report.quality,
        report.monetization,
    )
    subjects = ", ".join(f"{item.subject} {item.learned_questions}" for item in learn.learned_by_subject)
    top = [f"  - {r.subject} Nr. {r.number}: {r.reports}x" for r in q.top_reported_7d]
    lines = [
        f"SKS Lotse - Tagesreport {report.generated_at:%d.%m.%Y}",
        "",
        "WACHSTUM",
        f"Konten gesamt: {g.users_total}",
        f"Neu (24 h / Vortag / 7 Tage): {g.new_24h} / {g.new_previous_24h} / {g.new_7d}",
        "Prüfungsvariante Motor / Segeln+Motor / offen: "
        f"{g.variant_motor} / {g.variant_segeln_und_motor} / {g.variant_unset}",
        f"Aktivierung (Neukonten 7 Tage mit mind. 1 Bewertung): {_pct(g.activation_rate_7d)}",
        "",
        "ENGAGEMENT",
        f"Aktiv DAU (Vortag) / WAU / MAU: {e.dau} ({e.dau_previous}) / {e.wau} / {e.mau}",
        f"Stickiness DAU/MAU: {_pct(e.stickiness)}",
        "Retention (Konten von vor 7-14 Tagen, letzte 7 Tage aktiv): "
        f"{_pct(e.retention_rate)} von {e.retention_cohort_size}",
        f"Bewertungen 24 h: {e.ratings_24h} ({_num(e.ratings_per_active_user_24h)} je aktivem Nutzer)",
        "",
        "LERNERFOLG",
        f"Lernende: {learn.learners}, gelernte Fragen: {learn.learned_questions_total} "
        f"({_num(learn.learned_per_learner)} je Lernendem)",
        f"Gelernt je Fach: {subjects or '-'}",
        f"Nutzer mit Fokus-Themen: {learn.focus_users}",
        "Prüfungen 24 h gestartet / abgegeben / Zeit abgelaufen: "
        f"{learn.exams_started_24h} / {learn.exams_submitted_24h} / {learn.exams_timed_out_24h}",
        f"Prüfungen 7 Tage bewertet / bestanden: {learn.exams_graded_7d} / {learn.exams_passed_7d}",
        "Kartenaufgaben-Läufe 24 h gestartet / abgeschlossen: "
        f"{learn.chart_attempts_started_24h} / {learn.chart_attempts_completed_24h}",
        "",
        "LOTSEN-CHECK UND UMSATZ",
        "Lotsen-Checks 24 h Katalog / Kartenaufgabe: "
        f"{m.lotse_checks_catalog_24h} / {m.lotse_checks_chart_24h}",
        f"Verbrauchte Tokens 24 h / 7 Tage: {m.tokens_spent_24h} / {m.tokens_spent_7d}",
        f"Käufe 24 h / 7 Tage: {m.purchases_24h} / {m.purchases_7d}",
        f"Umsatz 24 h / 7 Tage: {_eur(m.revenue_cents_24h)} / {_eur(m.revenue_cents_7d)}",
        "",
        "QUALITÄT",
        f"Fragenmeldungen 24 h / gesamt: {q.reports_24h} / {q.reports_total}",
        f"KI-Prüfung Sanitizer-Flags (24 h neu / gesamt): {q.ai_flags_24h} / {q.ai_flags_total}",
        "Meistgemeldet (7 Tage):",
        *(top or ["  -"]),
    ]
    return "\n".join(lines) + "\n"
