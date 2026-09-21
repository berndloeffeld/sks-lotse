import pytest

from app.core.config import settings
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
    assert {"last_graded_at", "review_due_at"} <= row.keys()


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
