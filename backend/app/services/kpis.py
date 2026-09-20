from datetime import datetime, timedelta

from sqlalchemy import distinct, exists, func, select, union
from sqlalchemy.orm import Session

from app.core.exam import OUTCOME_POINTS, PASS_MIN_POINTS
from app.core.progress import LEARNED_STREAK_THRESHOLD
from app.models.exam_attempt import ExamAttempt
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.user import User
from app.schemas.kpis import (
    EngagementKpis,
    GrowthKpis,
    KpiReport,
    LearningKpis,
    QualityKpis,
    ReportedQuestion,
)

TOP_REPORTED_LIMIT = 5


def _ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def _count(db: Session, query) -> int:
    return db.execute(select(func.count()).select_from(query.subquery())).scalar_one()


def _active_user_ids(since: datetime, until: datetime):
    """Learners with a graded question or a started exam in [since, until)."""
    graded = select(QuestionProgress.user_id).where(
        QuestionProgress.updated_at >= since, QuestionProgress.updated_at < until
    )
    started = select(ExamAttempt.user_id).where(
        ExamAttempt.started_at >= since, ExamAttempt.started_at < until
    )
    return union(graded, started)


def _active_users(db: Session, since: datetime, until: datetime) -> int:
    return _count(db, _active_user_ids(since, until))


def _users_created(db: Session, since: datetime, until: datetime) -> int:
    return db.execute(
        select(func.count()).select_from(User).where(User.created_at >= since, User.created_at < until)
    ).scalar_one()


def _growth(db: Session, now: datetime) -> GrowthKpis:
    day = timedelta(days=1)
    week = 7 * day
    variants = dict(db.execute(select(User.exam_variant, func.count()).group_by(User.exam_variant)).all())
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
        select(func.count()).select_from(QuestionProgress).where(QuestionProgress.updated_at >= now - day)
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
    passed = sum(
        1
        for attempt in attempts
        if sum(OUTCOME_POINTS.get(q.outcome or "", 0) for q in attempt.questions) >= PASS_MIN_POINTS
    )
    return len(attempts), passed


def _exam_count(db: Session, column, since: datetime, until: datetime) -> int:
    return db.execute(
        select(func.count()).select_from(ExamAttempt).where(column >= since, column < until)
    ).scalar_one()


def _learning(db: Session, now: datetime) -> LearningKpis:
    day = timedelta(days=1)
    learned = QuestionProgress.correct_streak >= LEARNED_STREAK_THRESHOLD
    by_subject = dict(
        db.execute(
            select(Question.subject, func.count())
            .join(QuestionProgress, QuestionProgress.question_id == Question.id)
            .where(learned)
            .group_by(Question.subject)
        ).all()
    )
    learners = db.execute(select(func.count(distinct(QuestionProgress.user_id)))).scalar_one()
    graded, passed = _exams_passed(db, now - 7 * day)
    return LearningKpis(
        learners=learners,
        learned_questions_total=sum(by_subject.values()),
        learned_per_learner=_ratio(sum(by_subject.values()), learners),
        learned_by_subject=by_subject,
        focus_users=db.execute(select(func.count(distinct(FocusTopic.user_id)))).scalar_one(),
        exams_started_24h=_exam_count(db, ExamAttempt.started_at, now - day, now),
        exams_submitted_24h=_exam_count(db, ExamAttempt.submitted_at, now - day, now),
        exams_timed_out_24h=db.execute(
            select(func.count())
            .select_from(ExamAttempt)
            .where(ExamAttempt.timed_out, ExamAttempt.started_at >= now - day)
        ).scalar_one(),
        exams_graded_7d=graded,
        exams_passed_7d=passed,
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
    )


def compute_kpis(db: Session, now: datetime) -> KpiReport:
    """Aggregate usage numbers as of `now` (timezone-aware UTC)."""
    return KpiReport(
        generated_at=now,
        growth=_growth(db, now),
        engagement=_engagement(db, now),
        learning=_learning(db, now),
        quality=_quality(db, now),
    )


def _pct(value: float | None) -> str:
    return "-" if value is None else f"{value * 100:.0f} %"


def _num(value: float | None) -> str:
    return "-" if value is None else f"{value:.1f}"


def format_report(report: KpiReport) -> str:
    """German plain-text rendering of the report, for the daily mail."""
    g, e, learn, q = report.growth, report.engagement, report.learning, report.quality
    subjects = ", ".join(f"{name} {count}" for name, count in sorted(learn.learned_by_subject.items()))
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
        "",
        "QUALITÄT",
        f"Fragenmeldungen 24 h / gesamt: {q.reports_24h} / {q.reports_total}",
        "Meistgemeldet (7 Tage):",
        *(top or ["  -"]),
    ]
    return "\n".join(lines) + "\n"
