"""The per-question grading history the admin sees (ADR-0051) and the log behind it."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.question import Question
from app.models.question_grading_log import QuestionGradingLog
from app.models.user import User
from tests.helpers import fixture_user, make_admin


def _question(db_session, number: int = 1) -> Question:
    question = Question(subject="navigation", number=number, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    return question


def _log(db_session, user: User, question: Question, outcome: str, graded_at: datetime, half_life: float):
    db_session.add(
        QuestionGradingLog(
            user_id=user.id,
            question_id=question.id,
            outcome=outcome,
            graded_at=graded_at,
            half_life_days=half_life,
        )
    )
    db_session.commit()


def test_every_practice_grading_is_logged_with_the_resulting_half_life(client, db_session, auth_headers):
    question = _question(db_session)
    url = f"/api/v1/progress/questions/{question.id}"
    for outcome in ("richtig", "teilweise_richtig", "falsch"):
        assert client.post(url, json={"outcome": outcome}, headers=auth_headers).status_code == 200

    log = db_session.query(QuestionGradingLog).order_by(QuestionGradingLog.id).all()
    assert [row.outcome for row in log] == ["richtig", "teilweise_richtig", "falsch"]
    assert [row.half_life_days for row in log] == pytest.approx([2.5, 1.25, 0.3125], abs=0.01)
    assert {row.user_id for row in log} == {fixture_user(db_session).id}


def test_history_groups_by_learner_newest_learner_first(client, db_session, auth_headers, monkeypatch):
    make_admin(monkeypatch)
    admin = fixture_user(db_session)
    other = User(email="learner@example.com")
    db_session.add(other)
    db_session.commit()
    question = _question(db_session)
    unrelated = _question(db_session, number=2)
    base = datetime(2026, 9, 1, tzinfo=UTC)
    _log(db_session, admin, question, "richtig", base, 2.5)
    _log(db_session, other, question, "falsch", base + timedelta(days=1), 0.25)
    _log(db_session, admin, question, "richtig", base + timedelta(days=3), 6.25)
    _log(db_session, other, unrelated, "richtig", base + timedelta(days=4), 2.5)

    response = client.get(f"/api/v1/admin/questions/{question.id}/history", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["question_id"] == question.id
    assert [(u["user_id"], u["email"]) for u in body["users"]] == [
        (admin.id, admin.email),
        (other.id, "learner@example.com"),
    ]
    admin_gradings = body["users"][0]["gradings"]
    assert [(g["outcome"], g["half_life_days"]) for g in admin_gradings] == [
        ("richtig", 2.5),
        ("richtig", 6.25),
    ]
    assert admin_gradings[0]["graded_at"].startswith("2026-09-01")
    assert [g["outcome"] for g in body["users"][1]["gradings"]] == ["falsch"]


def test_history_of_a_never_graded_question_is_empty(client, db_session, auth_headers, monkeypatch):
    make_admin(monkeypatch)
    question = _question(db_session)

    response = client.get(f"/api/v1/admin/questions/{question.id}/history", headers=auth_headers)

    assert response.json() == {"question_id": question.id, "users": []}


def test_history_returns_404_for_unknown_question(client, db_session, auth_headers, monkeypatch):
    make_admin(monkeypatch)
    response = client.get("/api/v1/admin/questions/999999/history", headers=auth_headers)
    assert response.status_code == 404


def test_history_is_audit_logged_without_personal_data(client, db_session, auth_headers, monkeypatch, caplog):
    make_admin(monkeypatch)
    admin = fixture_user(db_session)
    question = _question(db_session)
    _log(db_session, admin, question, "richtig", datetime(2026, 9, 1, tzinfo=UTC), 2.5)

    with caplog.at_level("INFO", logger="app.api.v1.admin"):
        client.get(f"/api/v1/admin/questions/{question.id}/history", headers=auth_headers)

    messages = [r.getMessage() for r in caplog.records if r.name == "app.api.v1.admin"]
    assert messages == [f"admin action: admin={admin.id} action=question_history question_id={question.id}"]


def test_export_includes_the_grading_log(client, db_session, auth_headers, monkeypatch):
    make_admin(monkeypatch)
    user = fixture_user(db_session)
    question = _question(db_session)
    _log(db_session, user, question, "teilweise_richtig", datetime(2026, 9, 1, tzinfo=UTC), 0.5)

    body = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers).json()

    assert len(body["question_gradings"]) == 1
    row = body["question_gradings"][0]
    assert (
        row.items()
        >= {
            "question_id": question.id,
            "subject": "navigation",
            "question_number": 1,
            "outcome": "teilweise_richtig",
            "half_life_days": 0.5,
        }.items()
    )
    assert row["graded_at"].startswith("2026-09-01")


def test_deleting_the_account_deletes_its_grading_log(client, db_session, auth_headers, monkeypatch):
    make_admin(monkeypatch)
    target = User(email="target@example.com")
    db_session.add(target)
    db_session.commit()
    target_id = target.id
    question = _question(db_session)
    _log(db_session, target, question, "richtig", datetime(2026, 9, 1, tzinfo=UTC), 2.5)

    assert client.delete(f"/api/v1/admin/users/{target_id}", headers=auth_headers).status_code == 204

    db_session.expire_all()
    assert db_session.query(QuestionGradingLog).filter_by(user_id=target_id).count() == 0
