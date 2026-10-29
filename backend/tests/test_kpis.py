from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.models.chart_attempt import ChartAttempt, ChartAttemptTask
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.focus_topic import FocusTopic
from app.models.lotse_check_log import LotseCheckLog
from app.models.purchase import Purchase
from app.models.question import Question
from app.models.question_grading_log import QuestionGradingLog
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.topic import Topic
from app.models.user import User
from app.services import email as email_service
from app.services import lotse_check
from app.services.kpis import compute_dashboard, compute_kpis, daily_series, format_report
from scripts import send_daily_report
from tests.helpers import progress_state

NOW = datetime(2026, 9, 20, 12, 0, tzinfo=UTC)


def _ago(**delta) -> datetime:
    return NOW - timedelta(**delta)


def _populate(db) -> None:
    active = User(
        email="active@example.com",
        exam_variant="motor",
        created_at=_ago(hours=2),
        ai_flags_count=2,
        ai_flags_last_at=_ago(hours=1),
    )
    yesterday = User(email="yesterday@example.com", created_at=_ago(hours=30))
    cohort = User(email="cohort@example.com", exam_variant="segeln_und_motor", created_at=_ago(days=10))
    idle = User(
        email="idle@example.com",
        exam_variant="motor",
        created_at=_ago(days=40),
        ai_flags_count=1,
        ai_flags_last_at=_ago(days=40),
    )
    nav = Question(subject="navigation", number=1, question_text="q", answer_text="a")
    weather = Question(subject="wetterkunde", number=1, question_text="q", answer_text="a")
    topic = Topic(subject="navigation", slug="t", name="T", display_order=1)
    db.add_all([active, yesterday, cohort, idle, nav, weather, topic])
    db.flush()

    db.add_all(
        [
            QuestionProgress(
                user_id=active.id,
                question_id=nav.id,
                **progress_state(3),
                created_at=_ago(hours=1),
                updated_at=_ago(hours=1),
            ),
            QuestionProgress(
                user_id=cohort.id,
                question_id=weather.id,
                **progress_state(1),
                created_at=_ago(days=3),
                updated_at=_ago(days=3),
            ),
            QuestionGradingLog(
                user_id=active.id,
                question_id=nav.id,
                outcome="richtig",
                graded_at=_ago(hours=1),
                half_life_days=1,
            ),
            QuestionGradingLog(
                user_id=cohort.id,
                question_id=weather.id,
                outcome="richtig",
                graded_at=_ago(days=3),
                half_life_days=1,
            ),
            FocusTopic(user_id=active.id, topic_id=topic.id),
            QuestionReport(user_id=active.id, question_id=nav.id, category="wrong", created_at=_ago(hours=1)),
        ]
    )
    attempt = ExamAttempt(
        user_id=active.id,
        exam_variant="motor",
        started_at=_ago(hours=1),
        deadline_at=_ago(hours=1) + timedelta(minutes=90),
        submitted_at=_ago(minutes=30),
        graded_at=_ago(minutes=20),
    )
    db.add(attempt)
    db.flush()
    db.add_all(
        ExamAttemptQuestion(
            attempt_id=attempt.id,
            question_id=nav.id,
            position=i,
            subject_group="navigation",
            outcome="richtig",
        )
        for i in range(1, 31)
    )
    db.commit()


def test_kpis_on_an_empty_database(db_session):
    report = compute_kpis(db_session, NOW)

    assert report.growth.users_total == 0
    assert report.growth.activation_rate_7d is None
    assert report.engagement.stickiness is None
    assert report.engagement.retention_rate is None
    assert report.learning.learned_per_learner is None
    assert report.quality.top_reported_7d == []
    assert (report.quality.ai_flags_24h, report.quality.ai_flags_total) == (0, 0)
    text = format_report(report)
    assert "Konten gesamt: 0" in text
    assert "Aktivierung (Neukonten 7 Tage mit mind. 1 Bewertung): -" in text


def test_kpis_count_each_group(db_session):
    _populate(db_session)

    report = compute_kpis(db_session, NOW)

    growth = report.growth
    assert (growth.users_total, growth.new_24h, growth.new_previous_24h, growth.new_7d) == (4, 1, 1, 2)
    assert (growth.variant_motor, growth.variant_segeln_und_motor, growth.variant_unset) == (2, 1, 1)
    assert growth.activation_rate_7d == 0.5

    engagement = report.engagement
    # The learner's graded question and exam start are the same person: counted once.
    assert (engagement.dau, engagement.dau_previous, engagement.wau, engagement.mau) == (1, 0, 2, 2)
    assert engagement.stickiness == 0.5
    assert (engagement.retention_cohort_size, engagement.retention_rate) == (1, 1.0)
    assert (engagement.ratings_24h, engagement.ratings_per_active_user_24h) == (1, 1.0)

    learning = report.learning
    assert (learning.learners, learning.learned_questions_total, learning.learned_per_learner) == (2, 1, 0.5)
    assert [(i.subject, i.learned_questions) for i in learning.learned_by_subject] == [("navigation", 1)]
    assert learning.focus_users == 1
    assert (learning.exams_started_24h, learning.exams_submitted_24h, learning.exams_timed_out_24h) == (
        1,
        1,
        0,
    )
    assert (learning.exams_graded_7d, learning.exams_passed_7d) == (1, 1)

    quality = report.quality
    assert (quality.reports_24h, quality.reports_total) == (1, 1)
    assert [(r.subject, r.number, r.reports) for r in quality.top_reported_7d] == [("navigation", 1, 1)]
    # active was flagged within the last 24h; idle was flagged 40 days ago and doesn't count there.
    assert (quality.ai_flags_24h, quality.ai_flags_total) == (1, 3)


def test_exam_below_the_pass_mark_is_not_counted_as_passed(db_session):
    _populate(db_session)
    db_session.query(ExamAttemptQuestion).update({"outcome": "falsch"})
    db_session.commit()

    learning = compute_kpis(db_session, NOW).learning

    assert (learning.exams_graded_7d, learning.exams_passed_7d) == (1, 0)


def test_format_report_lists_the_numbers(db_session):
    _populate(db_session)

    text = format_report(compute_kpis(db_session, NOW))

    assert "Tagesreport 20.09.2026" in text
    assert "Neu (24 h / Vortag / 7 Tage): 1 / 1 / 2" in text
    assert "Gelernt je Fach: navigation 1" in text
    assert "  - navigation Nr. 1: 1x" in text
    assert "KI-Prüfung Sanitizer-Flags (24 h neu / gesamt): 1 / 3" in text


def test_send_kpi_report_email(monkeypatch):
    calls = []
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda params: calls.append(params))

    email_service.send_kpi_report_email("admin@example.com", "Betreff", "a <b>\n")

    assert calls[0]["to"] == "admin@example.com"
    assert calls[0]["subject"] == "Betreff"
    assert calls[0]["text"] == "a <b>\n"
    assert "a &lt;b&gt;" in calls[0]["html"]


def test_daily_report_script_mails_every_admin(db_session, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "one@example.com, two@example.com")
    monkeypatch.setattr(send_daily_report, "SessionLocal", lambda: db_session)
    sent = []
    monkeypatch.setattr(send_daily_report, "send_kpi_report_email", lambda *args: sent.append(args))

    assert send_daily_report.main() == 0

    assert [args[0] for args in sent] == ["one@example.com", "two@example.com"]
    assert sent[0][1].startswith("SKS Lotse & SBF Lotse Tagesreport")
    assert "WACHSTUM" in sent[0][2]


def test_daily_report_script_fails_without_admins(monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "")

    assert send_daily_report.main() == 1


_DAY = timedelta(days=1)


def _user(db, name, created=timedelta(days=60)) -> User:
    user = User(email=f"{name}@example.com", created_at=NOW - created)
    db.add(user)
    db.flush()
    return user


def _rated(db, user, question, ago) -> None:
    at = NOW - ago
    db.add(
        QuestionGradingLog(
            user_id=user.id, question_id=question.id, outcome="richtig", graded_at=at, half_life_days=1
        )
    )
    db.add(
        QuestionProgress(
            user_id=user.id, question_id=question.id, **progress_state(1), created_at=at, updated_at=at
        )
    )


def _started_exam(db, user, ago) -> None:
    at = NOW - ago
    db.add(
        ExamAttempt(
            user_id=user.id, exam_variant="motor", started_at=at, deadline_at=at + timedelta(minutes=90)
        )
    )


def test_activity_windows_are_half_open_and_exactly_1_7_and_30_days_long(db_session):
    # One learner per case, each active exactly once: the windows are [since, until).
    question = Question(subject="navigation", number=1, question_text="q", answer_text="a")
    db_session.add(question)
    db_session.flush()
    for name, ago in {
        "in-24h": timedelta(hours=23),
        "exactly-24h": _DAY,  # counts for the last 24h, not for the 24h before
        "previous-24h": timedelta(hours=25),
        "in-7d": timedelta(days=6, hours=22),
        "over-7d": timedelta(days=7, hours=2),
        "in-30d": timedelta(days=29, hours=22),
        "over-30d": timedelta(days=30, hours=2),
    }.items():
        _rated(db_session, _user(db_session, name), question, ago)
    _started_exam(db_session, _user(db_session, "exam-today"), timedelta(hours=12))  # exam-only activity
    _started_exam(db_session, _user(db_session, "exam-long-ago"), timedelta(days=40))
    db_session.commit()

    engagement = compute_kpis(db_session, NOW).engagement

    assert engagement.dau == 3  # in-24h, exactly-24h, exam-today
    assert engagement.dau_previous == 1  # previous-24h; exactly-24h belongs to the later window
    assert engagement.wau == 5  # + previous-24h, in-7d
    assert engagement.mau == 7  # + over-7d, in-30d
    assert engagement.ratings_24h == 2  # in-24h, exactly-24h (exam starts aren't ratings)


def test_signup_windows_and_the_retention_cohort_are_1_7_and_7_to_14_days(db_session):
    question = Question(subject="navigation", number=1, question_text="q", answer_text="a")
    db_session.add(question)
    db_session.flush()
    created = {
        "in-24h": timedelta(hours=23),
        "exactly-24h": _DAY,
        "previous-24h": timedelta(hours=47),
        "before-previous-24h": timedelta(hours=60),  # neither in the last 24h nor in the 24h before
        "in-7d": timedelta(days=6, hours=22),
        "exactly-7d": timedelta(days=7),  # counts as new this week, belongs to no cohort
        "cohort-early": timedelta(days=13, hours=22),
        "exactly-14d": timedelta(days=14),  # the oldest cohort member
        "cohort-late": timedelta(days=7, hours=2),
        "before-cohort": timedelta(days=14, hours=2),
    }
    users = {name: _user(db_session, name, ago) for name, ago in created.items()}
    # Active again within the last week: one of the two cohort members, and one who is no cohort member.
    _rated(db_session, users["cohort-late"], question, timedelta(hours=1))
    _rated(db_session, users["exactly-14d"], question, timedelta(hours=1))
    _rated(db_session, users["before-cohort"], question, timedelta(hours=1))
    db_session.commit()

    report = compute_kpis(db_session, NOW)

    assert report.growth.new_24h == 2  # in-24h, exactly-24h
    assert report.growth.new_previous_24h == 1  # previous-24h
    assert report.growth.new_7d == 6  # all of the above, incl. exactly-7d
    assert (report.growth.variant_motor, report.growth.variant_segeln_und_motor) == (0, 0)
    assert report.engagement.retention_cohort_size == 3  # cohort-early, cohort-late, exactly-14d
    assert report.engagement.retention_rate == pytest.approx(2 / 3)  # early wasn't back


def test_daily_report_script_keeps_sending_after_a_failure_and_then_fails(db_session, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "one@example.com, two@example.com")
    monkeypatch.setattr(settings, "betterstack_heartbeat_url", "https://heartbeat.example/x")
    monkeypatch.setattr(send_daily_report, "SessionLocal", lambda: db_session)
    sent = []

    def flaky(recipient, *args):
        if recipient == "one@example.com":
            raise RuntimeError("Resend down")
        sent.append(recipient)

    monkeypatch.setattr(send_daily_report, "send_kpi_report_email", flaky)
    pinged = []
    monkeypatch.setattr(send_daily_report, "_ping_heartbeat", lambda: pinged.append(True))

    assert send_daily_report.main() == 1
    assert sent == ["two@example.com"]
    # A partial failure must not tell Better Stack the run was fine.
    assert pinged == []


def test_daily_report_script_pings_the_heartbeat_after_success(db_session, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "one@example.com")
    monkeypatch.setattr(settings, "betterstack_heartbeat_url", "https://heartbeat.example/x")
    monkeypatch.setattr(send_daily_report, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(send_daily_report, "send_kpi_report_email", lambda *args: None)
    opened = []

    class _Response:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_urlopen(url, timeout):
        opened.append((url, timeout))
        return _Response()

    monkeypatch.setattr(send_daily_report.urllib.request, "urlopen", fake_urlopen)

    assert send_daily_report.main() == 0
    assert opened == [("https://heartbeat.example/x", 10)]


def test_heartbeat_is_skipped_without_url_and_its_failure_is_only_logged(monkeypatch, caplog):
    def fail(*args, **kwargs):
        raise OSError("unreachable")

    monkeypatch.setattr(send_daily_report.urllib.request, "urlopen", fail)
    monkeypatch.setattr(settings, "betterstack_heartbeat_url", "")
    send_daily_report._ping_heartbeat()
    assert caplog.records == []

    monkeypatch.setattr(settings, "betterstack_heartbeat_url", "https://heartbeat.example/x")
    send_daily_report._ping_heartbeat()
    assert [r.getMessage() for r in caplog.records] == ["Heartbeat ping failed"]


def _chart_run(db, user, *, started, answered=None, completed=None) -> None:
    attempt = ChartAttempt(
        user_id=user.id,
        exercise_number=1,
        started_at=NOW - started,
        completed_at=None if completed is None else NOW - completed,
    )
    db.add(attempt)
    db.flush()
    if answered is not None:
        db.add(
            ChartAttemptTask(
                attempt_id=attempt.id, task_number=1, answer_text="x", answered_at=NOW - answered
            )
        )


def test_a_learner_who_only_does_chart_exercises_counts_as_active(db_session):
    _chart_run(
        db_session, _user(db_session, "chart-only"), started=timedelta(hours=3), answered=timedelta(hours=2)
    )
    _chart_run(
        db_session, _user(db_session, "chart-old"), started=timedelta(days=40), answered=timedelta(days=40)
    )
    db_session.commit()

    report = compute_kpis(db_session, NOW)

    assert (report.engagement.dau, report.engagement.mau) == (1, 1)


def test_chart_runs_started_and_completed_in_the_last_24h(db_session):
    user = _user(db_session, "runner")
    _chart_run(
        db_session,
        user,
        started=timedelta(hours=5),
        answered=timedelta(hours=4),
        completed=timedelta(hours=1),
    )
    _chart_run(db_session, _user(db_session, "other"), started=timedelta(hours=2))
    _chart_run(db_session, _user(db_session, "old"), started=timedelta(days=3), completed=timedelta(days=2))
    db_session.commit()

    learning = compute_kpis(db_session, NOW).learning

    assert (learning.chart_attempts_started_24h, learning.chart_attempts_completed_24h) == (2, 1)


def test_lotsen_checks_tokens_and_stripe_purchases_are_counted_in_their_windows(db_session):
    user = _user(db_session, "buyer")

    def check(kind, tokens, ago):
        db_session.add(LotseCheckLog(kind=kind, tokens=tokens, checked_at=NOW - ago))

    check("catalog", 1, timedelta(hours=1))
    check("catalog", 1, timedelta(hours=2))
    check("chart", 2, timedelta(hours=3))
    check("catalog", 1, timedelta(days=3))
    check("chart", 2, timedelta(days=8))

    def purchase(by, cents, ago, tokens=100):
        db_session.add(
            Purchase(
                user_id=user.id,
                product="tokens_m",
                tokens_granted=tokens,
                amount_eur_cents=cents,
                granted_by=by,
                created_at=NOW - ago,
            )
        )

    purchase("stripe", 499, timedelta(hours=5))
    purchase("stripe", 999, timedelta(days=4))
    purchase("stripe", 1999, timedelta(days=9))
    purchase("admin_manual", 500, timedelta(hours=1))  # an off-platform payment is not Stripe revenue
    purchase("signup", None, timedelta(hours=1))
    db_session.commit()

    money = compute_kpis(db_session, NOW).monetization

    assert (money.lotse_checks_catalog_24h, money.lotse_checks_chart_24h) == (2, 1)
    assert (money.tokens_spent_24h, money.tokens_spent_7d) == (4, 5)
    assert (money.purchases_24h, money.purchases_7d) == (1, 2)
    assert (money.revenue_cents_24h, money.revenue_cents_7d) == (499, 1498)


def test_the_report_text_has_the_new_sections(db_session):
    db_session.add(LotseCheckLog(kind="chart", tokens=2, checked_at=NOW - timedelta(hours=1)))
    db_session.add(LotseCheckLog(kind="sbf_navigation", tokens=2, checked_at=NOW - timedelta(hours=2)))
    db_session.add(
        Purchase(
            user_id=None,
            product="tokens_m",
            tokens_granted=100,
            amount_eur_cents=1250,
            granted_by="stripe",
            created_at=NOW - timedelta(hours=1),
        )
    )
    db_session.commit()

    text = format_report(compute_kpis(db_session, NOW))

    assert "Kartenaufgaben-Läufe 24 h gestartet / abgeschlossen: 0 / 0" in text
    assert "SBF-Navigationsaufgaben-Läufe 24 h gestartet / abgeschlossen: 0 / 0" in text
    assert "Lotsen-Checks 24 h Katalog / Kartenaufgabe / SBF-Navigationsaufgabe: 0 / 1 / 1" in text
    assert "Verbrauchte Tokens 24 h / 7 Tage: 4 / 4" in text
    assert "Käufe 24 h / 7 Tage: 1 / 1" in text
    assert "Umsatz 24 h / 7 Tage: 12,50 EUR / 12,50 EUR" in text


def test_purge_removes_only_log_rows_older_than_the_retention(db_session):
    for days in (1, 29, 31, 90):
        db_session.add(LotseCheckLog(kind="catalog", tokens=1, checked_at=NOW - timedelta(days=days)))
    db_session.commit()

    assert lotse_check.purge_check_log(db_session, NOW) == 2

    left = db_session.query(LotseCheckLog).count()
    assert left == 2


def test_the_daily_report_job_purges_the_old_log_rows(db_session, monkeypatch):
    old = datetime.now(UTC) - timedelta(days=45)
    db_session.add(LotseCheckLog(kind="catalog", tokens=1, checked_at=old))
    db_session.commit()
    monkeypatch.setattr(settings, "admin_emails", "one@example.com")
    monkeypatch.setattr(send_daily_report, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(send_daily_report, "send_kpi_report_email", lambda *args: None)

    assert send_daily_report.main() == 0

    assert db_session.query(LotseCheckLog).count() == 0


def _series(db, days=3):
    return {row.day.isoformat(): row for row in daily_series(db, NOW, days)}


def test_daily_series_has_one_row_per_utc_day_with_gaps_as_zero(db_session):
    _user(db_session, "today-first", created=timedelta(hours=12))  # 2026-09-20 00:00
    _user(db_session, "today-now", created=timedelta(minutes=1))
    _user(db_session, "two-days-ago", created=timedelta(days=1, hours=13))  # 2026-09-18 23:00
    _user(db_session, "before-the-window", created=timedelta(days=2, hours=13))  # 2026-09-17 23:00
    db_session.commit()

    rows = daily_series(db_session, NOW, 3)

    assert [row.day.isoformat() for row in rows] == ["2026-09-18", "2026-09-19", "2026-09-20"]
    assert [row.new_users for row in rows] == [1, 0, 2]
    assert all(row.ratings == row.active_users == row.purchases == 0 for row in rows)


def test_daily_active_users_count_each_learner_once_across_all_activities(db_session):
    question = Question(subject="navigation", number=1, question_text="q", answer_text="a")
    db_session.add(question)
    db_session.flush()
    busy = _user(db_session, "busy")
    _rated(db_session, busy, question, timedelta(hours=1))
    db_session.add(
        QuestionGradingLog(
            user_id=busy.id, question_id=question.id, outcome="falsch", graded_at=NOW, half_life_days=1
        )
    )
    _started_exam(db_session, busy, timedelta(hours=2))
    _chart_run(db_session, busy, started=timedelta(hours=3), answered=timedelta(hours=3))
    _started_exam(db_session, _user(db_session, "exam-yesterday"), timedelta(hours=20))
    _chart_run(db_session, _user(db_session, "chart-yesterday"), started=_DAY, answered=_DAY)
    db_session.commit()

    series = _series(db_session)

    assert (series["2026-09-20"].active_users, series["2026-09-20"].ratings) == (1, 1)  # NOW is not < now
    assert (series["2026-09-19"].active_users, series["2026-09-19"].ratings) == (2, 0)


def test_daily_checks_tokens_and_revenue_split_by_kind_and_stripe_only(db_session):
    user = _user(db_session, "buyer")
    for kind, tokens, ago in [("catalog", 1, 1), ("catalog", 1, 2), ("chart", 2, 3), ("chart", 2, 30)]:
        db_session.add(LotseCheckLog(kind=kind, tokens=tokens, checked_at=NOW - timedelta(hours=ago)))
    for by, cents in [("stripe", 499), ("stripe", 999), ("admin_manual", 500), ("signup", None)]:
        db_session.add(
            Purchase(
                user_id=user.id,
                product="tokens_m",
                tokens_granted=10,
                amount_eur_cents=cents,
                granted_by=by,
                created_at=NOW - timedelta(hours=1),
            )
        )
    db_session.commit()

    today, yesterday = _series(db_session)["2026-09-20"], _series(db_session)["2026-09-19"]

    assert (today.lotse_checks_catalog, today.lotse_checks_chart, today.tokens_spent) == (2, 1, 4)
    assert (yesterday.lotse_checks_catalog, yesterday.lotse_checks_chart, yesterday.tokens_spent) == (0, 1, 2)
    assert (today.purchases, today.revenue_cents) == (2, 1498)


def test_dau_previous_counts_a_learner_who_graded_again_since(db_session):
    # question_progress.updated_at only keeps the latest grading; the log keeps both days.
    question = Question(subject="navigation", number=1, question_text="q", answer_text="a")
    db_session.add(question)
    db_session.flush()
    user = _user(db_session, "daily")
    db_session.add(
        QuestionGradingLog(
            user_id=user.id,
            question_id=question.id,
            outcome="richtig",
            graded_at=NOW - timedelta(hours=30),
            half_life_days=1,
        )
    )
    _rated(db_session, user, question, timedelta(hours=1))
    db_session.commit()

    engagement = compute_kpis(db_session, NOW).engagement

    assert (engagement.dau, engagement.dau_previous) == (1, 1)


def test_dashboard_shares_the_reports_sections(db_session):
    _populate(db_session)

    dashboard = compute_dashboard(db_session, NOW, 7)
    report = compute_kpis(db_session, NOW)

    assert (dashboard.days, len(dashboard.daily), dashboard.generated_at) == (7, 7, NOW)
    assert dashboard.growth == report.growth
    assert dashboard.engagement == report.engagement
    assert dashboard.monetization == report.monetization
    assert dashboard.daily[-1].new_users == report.growth.new_24h  # both since 2026-09-19 12:00 / 09-20 00:00


def test_new_accounts_and_purchases_are_counted_per_site(db_session):
    # ADR-0070: the report says how much of it came from sbf-lotse.de.
    sks = User(email="sks@example.com", created_at=_ago(hours=2), signup_site="sks")
    sbf_today = User(email="sbf1@example.com", created_at=_ago(hours=3), signup_site="sbf")
    sbf_week = User(email="sbf2@example.com", created_at=_ago(days=3), signup_site="sbf")
    db_session.add_all([sks, sbf_today, sbf_week])
    db_session.flush()
    for user, site, cents, intent in (
        (sks, "sks", 299, "pi_a"),
        (sbf_today, "sbf", 599, "pi_b"),
        (sbf_week, None, 99, "pi_c"),
    ):
        db_session.add(
            Purchase(
                user_id=user.id,
                product="tokens_s",
                tokens_granted=20,
                amount_eur_cents=cents,
                granted_by="stripe",
                stripe_payment_intent_id=intent,
                site=site,
                created_at=_ago(hours=5),
            )
        )
    db_session.commit()

    report = compute_kpis(db_session, NOW)

    assert (report.growth.new_24h, report.growth.new_sbf_24h, report.growth.new_sbf_7d) == (2, 1, 2)
    assert (report.monetization.purchases_7d, report.monetization.purchases_sbf_7d) == (3, 1)
    assert report.monetization.revenue_cents_sbf_7d == 599
    text = format_report(report)
    assert "Davon auf SBF Lotse angelegt (24 h / 7 Tage): 1 / 2" in text
    assert "Davon auf SBF Lotse (7 Tage): 1 Käufe, 5,99 EUR" in text
    assert text.startswith("SKS Lotse & SBF Lotse - Tagesreport")


def test_a_saved_sbf_run_counts_as_activity_and_as_a_run(db_session):
    # ADR-0071: an answered subtask of a saved SBF run is learning, like an answered Kartenaufgabe task.
    from app.models.sbf_navigation_attempt import SbfNavigationAttempt, SbfNavigationAttemptSubtask

    learner = User(email="sbf-learner@example.com", created_at=_ago(days=3), signup_site="sbf")
    db_session.add(learner)
    db_session.flush()
    attempt = SbfNavigationAttempt(
        user_id=learner.id, task_number=1, started_at=_ago(hours=3), completed_at=_ago(hours=1)
    )
    db_session.add(attempt)
    db_session.flush()
    db_session.add(
        SbfNavigationAttemptSubtask(
            attempt_id=attempt.id, subtask_number=1, answer_text="079", answered_at=_ago(hours=2)
        )
    )
    db_session.commit()

    report = compute_kpis(db_session, NOW)

    assert report.engagement.dau == 1
    learn = report.learning
    assert (learn.sbf_navigation_attempts_started_24h, learn.sbf_navigation_attempts_completed_24h) == (1, 1)
