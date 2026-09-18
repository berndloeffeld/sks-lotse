from app.core.jwt import create_access_token
from app.core.progress import is_learned
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
