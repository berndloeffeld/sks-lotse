from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.topic import Topic
from app.models.user import User
from app.services import email as email_service
from app.services.kpis import compute_kpis, format_report
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
    assert sent[0][1].startswith("SKS Lotse Tagesreport")
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
