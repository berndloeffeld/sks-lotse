from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from tests.helpers import progress_state

_FIXTURE_EMAIL = "fixture-user@example.com"


def _fixture_user(db_session) -> User:
    return db_session.query(User).filter_by(email=_FIXTURE_EMAIL).one()


def _make_admin(monkeypatch) -> None:
    monkeypatch.setattr(settings, "admin_emails", _FIXTURE_EMAIL)


def test_admin_routes_require_authentication(client):
    assert client.post("/api/v1/admin/users/search", json={"email": _FIXTURE_EMAIL}).status_code == 401
    assert client.get("/api/v1/admin/users/1/export").status_code == 401
    assert client.delete("/api/v1/admin/users/1").status_code == 401
    assert client.patch("/api/v1/admin/users/1", json={"ai_grading_enabled": True}).status_code == 401


def test_admin_routes_reject_non_admin_user(client, db_session, auth_headers):
    # No admin_emails set at all — the fixture user is logged in but not an admin.
    response = client.post("/api/v1/admin/users/search", json={"email": _FIXTURE_EMAIL}, headers=auth_headers)
    assert response.status_code == 403
    response = client.get("/api/v1/admin/users/1/export", headers=auth_headers)
    assert response.status_code == 403
    response = client.delete("/api/v1/admin/users/1", headers=auth_headers)
    assert response.status_code == 403
    response = client.patch("/api/v1/admin/users/1", json={"ai_grading_enabled": True}, headers=auth_headers)
    assert response.status_code == 403


def test_admin_search_finds_user_case_insensitively(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.post(
        "/api/v1/admin/users/search", json={"email": _FIXTURE_EMAIL.upper()}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == _FIXTURE_EMAIL
    assert body["question_progress_count"] == 0


def test_admin_search_returns_404_for_unknown_email(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.post(
        "/api/v1/admin/users/search", json={"email": "nobody@example.com"}, headers=auth_headers
    )
    assert response.status_code == 404


def test_admin_export_includes_denormalized_question_progress(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(2)))
    db_session.commit()

    response = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == _FIXTURE_EMAIL
    assert len(body["question_progress"]) == 1
    row = body["question_progress"][0]
    assert row["subject"] == "navigation"
    assert row["question_number"] == 1
    assert row["half_life_days"] == pytest.approx(6.25)
    assert {"last_graded_at", "last_correct_at", "review_due_at"} <= row.keys()


def test_admin_search_and_export_include_every_profile_field(client, db_session, auth_headers, monkeypatch):
    # Art. 15/20 DSGVO: the export has to contain all personal data stored
    # about the learner — including the optional, self-reported profile fields.
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    user.first_name = "Anna"
    user.last_name = "Beispiel"
    user.gender = "weiblich"
    user.exam_variant = "motor"
    db_session.commit()

    search = client.post("/api/v1/admin/users/search", json={"email": _FIXTURE_EMAIL}, headers=auth_headers)
    export = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)

    expected = {"first_name": "Anna", "last_name": "Beispiel", "gender": "weiblich", "exam_variant": "motor"}
    assert search.json().items() >= expected.items()
    assert export.json()["user"].items() >= expected.items()


def test_admin_export_returns_404_for_unknown_user(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.get("/api/v1/admin/users/999999/export", headers=auth_headers)
    assert response.status_code == 404


def test_admin_delete_removes_user_and_cascades_progress(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    user_id = user.id
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1)))
    db_session.commit()

    response = client.delete(f"/api/v1/admin/users/{user_id}", headers=auth_headers)
    assert response.status_code == 204

    db_session.expire_all()
    assert db_session.get(User, user_id) is None
    assert db_session.query(QuestionProgress).filter_by(user_id=user_id).count() == 0


def test_admin_delete_returns_404_for_unknown_user(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.delete("/api/v1/admin/users/999999", headers=auth_headers)
    assert response.status_code == 404


def test_me_reports_is_admin_true_for_admin(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_admin"] is True


def test_me_reports_is_admin_false_for_non_admin(client, db_session, auth_headers):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_admin"] is False


def test_admin_export_includes_focus_topics(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    topic = Topic(subject="navigation", slug="ankern", name="Ankern", display_order=1)
    db_session.add(topic)
    db_session.commit()
    db_session.add(FocusTopic(user_id=user.id, topic_id=topic.id))
    db_session.commit()

    response = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)
    assert response.status_code == 200
    focus = response.json()["focus_topics"]
    assert [(f["subject"], f["topic_slug"], f["topic_name"]) for f in focus] == [
        ("navigation", "ankern", "Ankern")
    ]


def test_admin_can_toggle_ai_grading(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    assert user.ai_grading_enabled is False

    response = client.patch(
        f"/api/v1/admin/users/{user.id}", json={"ai_grading_enabled": True}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["ai_grading_enabled"] is True
    db_session.refresh(user)
    assert user.ai_grading_enabled is True

    response = client.patch(
        f"/api/v1/admin/users/{user.id}", json={"ai_grading_enabled": False}, headers=auth_headers
    )
    assert response.json()["ai_grading_enabled"] is False


def test_admin_can_toggle_ads_removed_independently(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    assert user.ads_removed is False

    response = client.patch(
        f"/api/v1/admin/users/{user.id}", json={"ads_removed": True}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["ads_removed"] is True
    assert response.json()["ai_grading_enabled"] is False
    db_session.refresh(user)
    assert user.ads_removed is True

    response = client.patch(
        f"/api/v1/admin/users/{user.id}", json={"ai_grading_enabled": True}, headers=auth_headers
    )
    assert response.json()["ads_removed"] is True
    assert response.json()["ai_grading_enabled"] is True

    response = client.patch(
        f"/api/v1/admin/users/{user.id}", json={"ads_removed": False}, headers=auth_headers
    )
    assert response.json()["ads_removed"] is False
    assert response.json()["ai_grading_enabled"] is True


def test_admin_update_rejects_invalid_body_and_unknown_user(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    assert client.patch(f"/api/v1/admin/users/{user.id}", json={}, headers=auth_headers).status_code == 422
    response = client.patch(
        "/api/v1/admin/users/999999", json={"ai_grading_enabled": True}, headers=auth_headers
    )
    assert response.status_code == 404


def test_admin_search_counts_only_that_users_progress(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    me = db_session.query(User).filter_by(email=_FIXTURE_EMAIL).one()
    other = User(email="other@example.com")
    db_session.add(other)
    questions = [Question(subject="navigation", number=n, question_text="Q", answer_text="A") for n in (1, 2)]
    db_session.add_all(questions)
    db_session.commit()
    db_session.add_all(
        [
            QuestionProgress(user_id=me.id, question_id=questions[0].id, **progress_state(1)),
            QuestionProgress(user_id=me.id, question_id=questions[1].id, **progress_state(1)),
            QuestionProgress(user_id=other.id, question_id=questions[0].id, **progress_state(1)),
        ]
    )
    db_session.commit()

    response = client.post("/api/v1/admin/users/search", json={"email": _FIXTURE_EMAIL}, headers=auth_headers)

    assert response.json()["question_progress_count"] == 2


def test_admin_export_contains_every_stored_exam_and_progress_field(
    client, db_session, auth_headers, monkeypatch
):
    # Art. 15/20 DSGVO: an export that silently drops a stored field is an incomplete disclosure.
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    question = Question(subject="wetterkunde", number=7, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    started = datetime(2026, 3, 1, 10, 0, tzinfo=UTC)
    attempt = ExamAttempt(
        user_id=user.id,
        exam_variant="motor",
        started_at=started,
        deadline_at=started + timedelta(minutes=90),
        submitted_at=started + timedelta(minutes=95),
        graded_at=started + timedelta(minutes=99),
        timed_out=True,
    )
    db_session.add(attempt)
    db_session.flush()
    db_session.add_all(
        [
            ExamAttemptQuestion(
                attempt_id=attempt.id,
                question_id=question.id,
                position=1,
                subject_group="wetterkunde",
                answer_text="Mein Text",
                outcome="teilweise_richtig",
            ),
            # A question that has since left the catalog: kept, but without subject/number.
            ExamAttemptQuestion(attempt_id=attempt.id, position=2, subject_group="navigation"),
        ]
    )
    correct_at = datetime(2026, 3, 2, 9, 0, tzinfo=UTC)
    db_session.add(
        QuestionProgress(
            user_id=user.id, question_id=question.id, last_correct_at=correct_at, **progress_state(2)
        )
    )
    db_session.commit()

    body = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers).json()

    [exam] = body["exam_attempts"]
    assert exam["exam_id"] == attempt.id
    assert exam["exam_variant"] == "motor"
    assert exam["timed_out"] is True
    assert exam["started_at"].startswith("2026-03-01T10:00")
    assert exam["deadline_at"].startswith("2026-03-01T11:30")
    assert exam["submitted_at"].startswith("2026-03-01T11:35")
    assert exam["graded_at"].startswith("2026-03-01T11:39")
    known, gone = exam["questions"]
    assert (known["subject"], known["question_number"]) == ("wetterkunde", 7)
    assert (known["answer_text"], known["outcome"]) == ("Mein Text", "teilweise_richtig")
    assert (gone["subject"], gone["question_number"], gone["outcome"]) == (None, None, None)
    assert body["question_progress"][0]["last_correct_at"].startswith("2026-03-02T09:00")


def test_settings_routes_require_admin(client, auth_headers):
    assert client.get("/api/v1/admin/settings").status_code == 401
    assert client.put("/api/v1/admin/settings", json={"ai_checks_weekly_default": 5}).status_code == 401
    assert client.get("/api/v1/admin/settings", headers=auth_headers).status_code == 403
    response = client.put(
        "/api/v1/admin/settings", json={"ai_checks_weekly_default": 5}, headers=auth_headers
    )
    assert response.status_code == 403


def test_admin_can_read_and_change_the_weekly_default(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    monkeypatch.setattr(settings, "grading_max_per_week", 100)
    assert client.get("/api/v1/admin/settings", headers=auth_headers).json() == {
        "ai_checks_weekly_default": 100
    }

    response = client.put(
        "/api/v1/admin/settings", json={"ai_checks_weekly_default": 40}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json() == {"ai_checks_weekly_default": 40}
    assert client.get("/api/v1/admin/settings", headers=auth_headers).json() == {
        "ai_checks_weekly_default": 40
    }
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["ai_checks_remaining"] == 40


@pytest.mark.parametrize("value", [-1, 10_001, "x", None])
def test_admin_settings_reject_invalid_default(client, db_session, auth_headers, monkeypatch, value):
    _make_admin(monkeypatch)
    response = client.put(
        "/api/v1/admin/settings", json={"ai_checks_weekly_default": value}, headers=auth_headers
    )
    assert response.status_code == 422


def test_admin_can_set_and_reset_a_per_user_weekly_limit(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    monkeypatch.setattr(settings, "grading_max_per_week", 100)
    user_id = _fixture_user(db_session).id
    url = f"/api/v1/admin/users/{user_id}"

    body = client.patch(url, json={"ai_checks_weekly_limit": 7}, headers=auth_headers).json()
    assert (body["ai_checks_weekly_limit"], body["ai_checks_limit"]) == (7, 7)
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["ai_checks_remaining"] == 7

    body = client.patch(url, json={"ai_checks_weekly_limit": None}, headers=auth_headers).json()
    assert (body["ai_checks_weekly_limit"], body["ai_checks_limit"]) == (None, 100)

    assert client.patch(url, json={"ai_checks_weekly_limit": -1}, headers=auth_headers).status_code == 422
