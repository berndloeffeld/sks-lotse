from app.core.config import settings
from app.core.jwt import create_access_token
from app.models.question import Question
from app.models.question_report import QuestionReport
from app.models.user import User
from app.services.user import delete_user_and_progress
from tests.helpers import fixture_user, make_admin


def _question(db_session) -> Question:
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    return question


def test_report_is_stored(client, db_session, auth_headers):
    question = _question(db_session)
    response = client.post(
        f"/api/v1/questions/{question.id}/report",
        json={"category": "typo", "comment": "  Tippfehler in Zeile 2  "},
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["question_id"] == question.id
    assert body["category"] == "typo"
    assert body["comment"] == "Tippfehler in Zeile 2"
    stored = db_session.query(QuestionReport).one()
    assert stored.user_id == fixture_user(db_session).id


def test_report_without_comment_is_allowed(client, db_session, auth_headers):
    question = _question(db_session)
    for comment in (None, "   "):
        response = client.post(
            f"/api/v1/questions/{question.id}/report",
            json={"category": "other", "comment": comment},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["comment"] is None


def test_report_rejects_unknown_category_and_long_comment(client, db_session, auth_headers):
    question = _question(db_session)
    url = f"/api/v1/questions/{question.id}/report"
    assert client.post(url, json={"category": "spam"}, headers=auth_headers).status_code == 422
    assert client.post(url, json={"comment": "x"}, headers=auth_headers).status_code == 422
    too_long = {"category": "other", "comment": "x" * 1001}
    assert client.post(url, json=too_long, headers=auth_headers).status_code == 422


def test_report_unknown_question_is_404(client, db_session, auth_headers):
    response = client.post("/api/v1/questions/999999/report", json={"category": "typo"}, headers=auth_headers)
    assert response.status_code == 404


def test_report_is_capped_per_user(client, db_session, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "question_report_max_per_window", 2)
    question = _question(db_session)
    url = f"/api/v1/questions/{question.id}/report"
    assert client.post(url, json={"category": "typo"}, headers=auth_headers).status_code == 201
    assert client.post(url, json={"category": "typo"}, headers=auth_headers).status_code == 201
    assert client.post(url, json={"category": "typo"}, headers=auth_headers).status_code == 429


def test_the_report_cap_is_per_user(client, db_session, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "question_report_max_per_window", 1)
    question = _question(db_session)
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(other.id, other.token_version)}"}
    url = f"/api/v1/questions/{question.id}/report"

    assert client.post(url, json={"category": "typo"}, headers=auth_headers).status_code == 201
    assert client.post(url, json={"category": "typo"}, headers=auth_headers).status_code == 429
    assert client.post(url, json={"category": "typo"}, headers=other_headers).status_code == 201


def test_admin_export_includes_the_reports(client, db_session, auth_headers, monkeypatch):
    make_admin(monkeypatch)
    question = _question(db_session)
    user = fixture_user(db_session)
    client.post(
        f"/api/v1/questions/{question.id}/report",
        json={"category": "answer_text", "comment": "Antwort unvollständig"},
        headers=auth_headers,
    )

    export = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers).json()
    [row] = export["question_reports"]
    assert (row["subject"], row["question_number"], row["category"]) == ("navigation", 1, "answer_text")
    assert row["comment"] == "Antwort unvollständig"


def test_deleting_the_account_deletes_its_reports(client, db_session, auth_headers):
    question = _question(db_session)
    client.post(f"/api/v1/questions/{question.id}/report", json={"category": "typo"}, headers=auth_headers)
    delete_user_and_progress(db_session, fixture_user(db_session))
    assert db_session.query(QuestionReport).count() == 0
