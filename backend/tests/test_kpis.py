from datetime import UTC, datetime, timedelta

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
_FIXTURE_EMAIL = "fixture-user@example.com"


def _ago(**delta) -> datetime:
    return NOW - timedelta(**delta)


def _populate(db) -> None:
    active = User(email="active@example.com", exam_variant="motor", created_at=_ago(hours=2))
    yesterday = User(email="yesterday@example.com", created_at=_ago(hours=30))
    cohort = User(email="cohort@example.com", exam_variant="segeln_und_motor", created_at=_ago(days=10))
    idle = User(email="idle@example.com", exam_variant="motor", created_at=_ago(days=40))
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


def test_admin_kpis_endpoint(client, db_session, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", _FIXTURE_EMAIL)

    response = client.get("/api/v1/admin/kpis", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["growth"]["users_total"] == 1


def test_admin_kpis_endpoint_requires_an_admin(client, db_session, auth_headers):
    assert client.get("/api/v1/admin/kpis").status_code == 401
    assert client.get("/api/v1/admin/kpis", headers=auth_headers).status_code == 403


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
