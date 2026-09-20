from app.core.jwt import create_access_token
from app.core.progress import is_learned, next_streak
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User


def _fixture_user(db_session) -> User:
    return db_session.query(User).filter_by(email="fixture-user@example.com").one()


def test_is_learned_threshold():
    assert is_learned(0) is False
    assert is_learned(2) is False
    assert is_learned(3) is True
    assert is_learned(4) is True


def test_progress_summary_requires_auth(client):
    response = client.get("/api/v1/progress/summary")
    assert response.status_code == 401


def test_progress_summary_empty_state(client, db_session, auth_headers):
    topic = Topic(subject="navigation", slug="a", name="A", display_order=1)
    db_session.add(topic)
    db_session.commit()
    db_session.add(
        Question(subject="navigation", number=1, question_text="Q?", answer_text="A", topic_id=topic.id)
    )
    db_session.commit()

    response = client.get("/api/v1/progress/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["total_questions"] == 1
    assert data[0]["learned_questions"] == 0


def test_progress_summary_scoped_by_exam_variant(client, db_session, auth_headers):
    db_session.add_all(
        [
            Topic(subject="navigation", slug="nav", name="Navigation", display_order=1),
            Topic(subject="seemannschaft_motor", slug="motor", name="Motor", display_order=1),
            Topic(subject="seemannschaft_segeln", slug="segeln", name="Segeln", display_order=1),
        ]
    )
    db_session.commit()

    user = _fixture_user(db_session)
    user.exam_variant = "motor"
    db_session.commit()

    response = client.get("/api/v1/progress/summary", headers=auth_headers)
    assert response.status_code == 200
    slugs = {row["topic_slug"] for row in response.json()}
    assert slugs == {"nav", "motor"}


def test_progress_summary_unset_exam_variant_returns_all_subjects(client, db_session, auth_headers):
    db_session.add_all(
        [
            Topic(subject="navigation", slug="nav", name="Navigation", display_order=1),
            Topic(subject="seemannschaft_motor", slug="motor", name="Motor", display_order=1),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/progress/summary", headers=auth_headers)
    assert response.status_code == 200
    slugs = {row["topic_slug"] for row in response.json()}
    assert slugs == {"nav", "motor"}


def test_progress_summary_learned_threshold_boundary(client, db_session, auth_headers):
    topic = Topic(subject="navigation", slug="nav", name="Navigation", display_order=1)
    db_session.add(topic)
    db_session.commit()

    questions = [
        Question(subject="navigation", number=n, question_text=f"Q{n}?", answer_text="A", topic_id=topic.id)
        for n in (1, 2, 3)
    ]
    db_session.add_all(questions)
    db_session.commit()

    user = _fixture_user(db_session)
    db_session.add_all(
        [
            QuestionProgress(user_id=user.id, question_id=questions[0].id, correct_streak=0),
            QuestionProgress(user_id=user.id, question_id=questions[1].id, correct_streak=2),
            QuestionProgress(user_id=user.id, question_id=questions[2].id, correct_streak=3),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/progress/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["total_questions"] == 3
    assert data[0]["learned_questions"] == 1


def test_progress_summary_isolated_per_user(client, db_session, auth_headers):
    topic = Topic(subject="navigation", slug="nav", name="Navigation", display_order=1)
    db_session.add(topic)
    db_session.commit()
    question = Question(
        subject="navigation", number=1, question_text="Q?", answer_text="A", topic_id=topic.id
    )
    db_session.add(question)
    db_session.commit()

    other_user = User(email="other-user@example.com")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)
    db_session.add(QuestionProgress(user_id=other_user.id, question_id=question.id, correct_streak=3))
    db_session.commit()

    response = client.get("/api/v1/progress/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["learned_questions"] == 0

    other_token = create_access_token(other_user.id, other_user.token_version)
    other_headers = {"Authorization": f"Bearer {other_token}"}
    response = client.get("/api/v1/progress/summary", headers=other_headers)
    assert response.status_code == 200
    assert response.json()[0]["learned_questions"] == 1


def test_progress_summary_ignores_untopiced_questions(client, db_session, auth_headers):
    db_session.add(
        Question(subject="navigation", number=1, question_text="Q?", answer_text="A", topic_id=None)
    )
    db_session.commit()

    response = client.get("/api/v1/progress/summary", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_next_streak_only_richtig_extends():
    assert next_streak(2, "richtig") == 3
    assert next_streak(2, "teilweise_richtig") == 0
    assert next_streak(2, "falsch") == 0


def _question(db_session) -> Question:
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    return question


def test_grade_question_requires_auth(client, db_session):
    question = _question(db_session)
    response = client.post(f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"})
    assert response.status_code == 401


def test_list_question_progress_requires_auth(client):
    assert client.get("/api/v1/progress/questions").status_code == 401


def test_grade_question_builds_and_resets_the_streak(client, db_session, auth_headers):
    question = _question(db_session)
    url = f"/api/v1/progress/questions/{question.id}"

    streaks = []
    for outcome in ("richtig", "richtig", "richtig", "teilweise_richtig", "richtig", "falsch"):
        response = client.post(url, json={"outcome": outcome}, headers=auth_headers)
        assert response.status_code == 200
        streaks.append((response.json()["correct_streak"], response.json()["learned"]))

    assert streaks == [(1, False), (2, False), (3, True), (0, False), (1, False), (0, False)]
    # One row per (user, question), however often it's graded.
    assert db_session.query(QuestionProgress).count() == 1


def test_grade_question_counts_towards_the_summary(client, db_session, auth_headers):
    topic = Topic(subject="navigation", slug="nav", name="Navigation", display_order=1)
    db_session.add(topic)
    db_session.commit()
    question = Question(
        subject="navigation", number=1, question_text="Q?", answer_text="A", topic_id=topic.id
    )
    db_session.add(question)
    db_session.commit()

    for _ in range(3):
        client.post(
            f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
        )

    response = client.get("/api/v1/progress/summary", headers=auth_headers)
    assert response.json()[0]["learned_questions"] == 1


def test_grade_question_unknown_question_is_404(client, db_session, auth_headers):
    response = client.post(
        "/api/v1/progress/questions/999", json={"outcome": "richtig"}, headers=auth_headers
    )
    assert response.status_code == 404


def test_grade_question_rejects_unknown_outcome(client, db_session, auth_headers):
    question = _question(db_session)
    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "fast richtig"}, headers=auth_headers
    )
    assert response.status_code == 422


def test_list_question_progress_returns_only_own_rows(client, db_session, auth_headers):
    questions = [
        Question(subject="navigation", number=n, question_text=f"Q{n}?", answer_text="A") for n in (1, 2, 3)
    ]
    db_session.add_all(questions)
    other_user = User(email="other-user@example.com")
    db_session.add(other_user)
    db_session.commit()
    user = _fixture_user(db_session)
    db_session.add_all(
        [
            QuestionProgress(user_id=user.id, question_id=questions[2].id, correct_streak=3),
            QuestionProgress(user_id=user.id, question_id=questions[0].id, correct_streak=1),
            QuestionProgress(user_id=other_user.id, question_id=questions[1].id, correct_streak=2),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/progress/questions", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == [
        {"question_id": questions[0].id, "correct_streak": 1, "learned": False},
        {"question_id": questions[2].id, "correct_streak": 3, "learned": True},
    ]


def test_grade_question_survives_a_concurrent_first_grading(client, db_session, auth_headers, monkeypatch):
    # Simulates a double submit: another request inserted the row between
    # this request's lookup and its insert.
    from app.api.v1 import progress as progress_api

    question = _question(db_session)
    user = _fixture_user(db_session)
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, correct_streak=1))
    db_session.commit()

    real_progress_row = progress_api._progress_row
    calls = []

    def stale_first_lookup(db, user_id, question_id):
        calls.append(question_id)
        return None if len(calls) == 1 else real_progress_row(db, user_id, question_id)

    monkeypatch.setattr(progress_api, "_progress_row", stale_first_lookup)

    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["correct_streak"] == 2
    assert db_session.query(QuestionProgress).count() == 1


def test_grade_question_409_when_the_racing_row_vanished(client, db_session, auth_headers, monkeypatch):
    from app.api.v1 import progress as progress_api

    question = _question(db_session)
    user = _fixture_user(db_session)
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, correct_streak=1))
    db_session.commit()
    # The row exists (so the insert collides) but every lookup misses it.
    monkeypatch.setattr(progress_api, "_progress_row", lambda db, user_id, question_id: None)

    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
    )

    assert response.status_code == 409
