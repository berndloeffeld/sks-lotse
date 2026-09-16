from app.models.question import Question


def test_list_questions_empty(client):
    response = client.get("/api/v1/questions")
    assert response.status_code == 200
    assert response.json() == []


def test_list_and_filter_questions(client, db_session):
    db_session.add_all(
        [
            Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"),
            Question(subject="wetterkunde", number=1, question_text="Q2?", answer_text="A2"),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/questions")
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = client.get("/api/v1/questions", params={"subject": "navigation"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["subject"] == "navigation"


def test_get_question_found(client, db_session):
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    db_session.refresh(question)

    response = client.get(f"/api/v1/questions/{question.id}")
    assert response.status_code == 200
    assert response.json()["question_text"] == "Q?"


def test_get_question_not_found(client):
    response = client.get("/api/v1/questions/999")
    assert response.status_code == 404


def test_random_question_not_found(client):
    response = client.get("/api/v1/questions/random")
    assert response.status_code == 404


def test_random_question_found(client, db_session):
    db_session.add(Question(subject="navigation", number=1, question_text="Q?", answer_text="A"))
    db_session.commit()

    response = client.get("/api/v1/questions/random")
    assert response.status_code == 200
    assert response.json()["subject"] == "navigation"


def test_random_question_filtered_by_subject(client, db_session):
    db_session.add_all(
        [
            Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"),
            Question(subject="wetterkunde", number=1, question_text="Q2?", answer_text="A2"),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/questions/random", params={"subject": "wetterkunde"})
    assert response.status_code == 200
    assert response.json()["subject"] == "wetterkunde"
