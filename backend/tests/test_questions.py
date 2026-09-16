from app.core import cache
from app.main import app
from app.models.question import Question


def test_questions_require_auth(client):
    response = client.get("/api/v1/questions")
    assert response.status_code == 401


def test_list_questions_empty(client, auth_headers):
    response = client.get("/api/v1/questions", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_and_filter_questions(client, db_session, auth_headers):
    db_session.add_all(
        [
            Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"),
            Question(subject="wetterkunde", number=1, question_text="Q2?", answer_text="A2"),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/questions", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = client.get("/api/v1/questions", params={"subject": "navigation"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["subject"] == "navigation"


def test_get_question_found(client, db_session, auth_headers):
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    db_session.refresh(question)

    response = client.get(f"/api/v1/questions/{question.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["question_text"] == "Q?"


def test_get_question_not_found(client, auth_headers):
    response = client.get("/api/v1/questions/999", headers=auth_headers)
    assert response.status_code == 404


def test_random_question_not_found(client, auth_headers):
    response = client.get("/api/v1/questions/random", headers=auth_headers)
    assert response.status_code == 404


def test_random_question_found(client, db_session, auth_headers):
    db_session.add(Question(subject="navigation", number=1, question_text="Q?", answer_text="A"))
    db_session.commit()

    response = client.get("/api/v1/questions/random", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["subject"] == "navigation"


def test_random_question_filtered_by_subject(client, db_session, auth_headers):
    db_session.add_all(
        [
            Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"),
            Question(subject="wetterkunde", number=1, question_text="Q2?", answer_text="A2"),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/questions/random", params={"subject": "wetterkunde"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["subject"] == "wetterkunde"


def test_list_questions_is_served_from_cache(client, db_session, auth_headers):
    db_session.add(Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"))
    db_session.commit()

    first = client.get("/api/v1/questions", headers=auth_headers)
    assert len(first.json()) == 1

    # Added straight to the DB, bypassing anything that would invalidate the
    # cache — proves the second request is served from the cached catalog,
    # not a fresh query.
    db_session.add(Question(subject="navigation", number=2, question_text="Q2?", answer_text="A2"))
    db_session.commit()

    second = client.get("/api/v1/questions", headers=auth_headers)
    assert len(second.json()) == 1

    cache.invalidate(app, "questions:catalog")
    third = client.get("/api/v1/questions", headers=auth_headers)
    assert len(third.json()) == 2
