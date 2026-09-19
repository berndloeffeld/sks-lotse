from app.core.jwt import create_access_token
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from app.services.user import delete_user_and_progress


def _fixture_user(db_session) -> User:
    return db_session.query(User).filter_by(email="fixture-user@example.com").one()


def _topic_with_questions(db_session, count=2, subject="navigation", slug="nav"):
    topic = Topic(subject=subject, slug=slug, name=slug.title(), display_order=1)
    db_session.add(topic)
    db_session.commit()
    questions = [
        Question(subject=subject, number=n, question_text=f"Q{n}?", answer_text="A", topic_id=topic.id)
        for n in range(1, count + 1)
    ]
    db_session.add_all(questions)
    db_session.commit()
    return topic, questions


def _set_streaks(db_session, questions, streaks):
    user = _fixture_user(db_session)
    db_session.add_all(
        QuestionProgress(user_id=user.id, question_id=q.id, correct_streak=s)
        for q, s in zip(questions, streaks, strict=True)
    )
    db_session.commit()


def _put(client, headers, subject="navigation", slug="nav"):
    return client.put(f"/api/v1/progress/focus/{subject}/{slug}", headers=headers)


def _summary(client, headers):
    return client.get("/api/v1/progress/summary", headers=headers).json()


def test_focus_endpoints_require_auth(client):
    assert client.put("/api/v1/progress/focus/navigation/nav").status_code == 401
    assert client.delete("/api/v1/progress/focus/navigation/nav").status_code == 401


def test_summary_counts_partially_learned_questions(client, db_session, auth_headers):
    _, questions = _topic_with_questions(db_session, count=4)
    _set_streaks(db_session, questions, [0, 1, 2, 3])

    row = _summary(client, auth_headers)[0]
    assert row["learned_questions"] == 1
    assert row["learning_questions"] == 2
    assert row["is_focus"] is False


def test_put_focus_marks_topic_and_is_idempotent(client, db_session, auth_headers):
    _topic_with_questions(db_session)

    assert _put(client, auth_headers).status_code == 204
    assert _put(client, auth_headers).status_code == 204

    assert db_session.query(FocusTopic).count() == 1
    assert _summary(client, auth_headers)[0]["is_focus"] is True


def test_delete_focus_unmarks_topic_and_is_idempotent(client, db_session, auth_headers):
    _topic_with_questions(db_session)
    _put(client, auth_headers)

    assert client.delete("/api/v1/progress/focus/navigation/nav", headers=auth_headers).status_code == 204
    assert client.delete("/api/v1/progress/focus/navigation/nav", headers=auth_headers).status_code == 204

    assert db_session.query(FocusTopic).count() == 0


def test_focus_unknown_topic_is_404(client, db_session, auth_headers):
    assert _put(client, auth_headers, slug="missing").status_code == 404
    assert client.delete("/api/v1/progress/focus/navigation/missing", headers=auth_headers).status_code == 404


def test_focus_topic_outside_exam_variant_is_404(client, db_session, auth_headers):
    _topic_with_questions(db_session, subject="seemannschaft_segeln", slug="segeln")
    user = _fixture_user(db_session)
    user.exam_variant = "motor"
    db_session.commit()

    assert _put(client, auth_headers, subject="seemannschaft_segeln", slug="segeln").status_code == 404


def test_focus_on_fully_learned_topic_is_409(client, db_session, auth_headers):
    _, questions = _topic_with_questions(db_session)
    _set_streaks(db_session, questions, [3, 4])

    assert _put(client, auth_headers).status_code == 409
    assert db_session.query(FocusTopic).count() == 0


def test_focus_on_topic_without_questions_is_allowed(client, db_session, auth_headers):
    _topic_with_questions(db_session, count=0)

    assert _put(client, auth_headers).status_code == 204


def test_focus_is_per_user(client, db_session, auth_headers):
    _topic_with_questions(db_session)
    _put(client, auth_headers)

    other = User(email="other-user@example.com")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_headers = {"Authorization": f"Bearer {create_access_token(other.id, other.token_version)}"}

    assert _summary(client, other_headers)[0]["is_focus"] is False


def test_grading_last_question_to_learned_removes_focus(client, db_session, auth_headers):
    _, questions = _topic_with_questions(db_session)
    _set_streaks(db_session, questions, [3, 2])
    _put(client, auth_headers)

    response = client.post(
        f"/api/v1/progress/questions/{questions[1].id}", json={"outcome": "richtig"}, headers=auth_headers
    )
    assert response.status_code == 200
    assert db_session.query(FocusTopic).count() == 0
    assert _summary(client, auth_headers)[0]["is_focus"] is False


def test_focus_removal_is_permanent_after_a_streak_reset(client, db_session, auth_headers):
    _, questions = _topic_with_questions(db_session, count=1)
    _set_streaks(db_session, questions, [2])
    _put(client, auth_headers)
    url = f"/api/v1/progress/questions/{questions[0].id}"

    client.post(url, json={"outcome": "richtig"}, headers=auth_headers)
    client.post(url, json={"outcome": "falsch"}, headers=auth_headers)

    assert _summary(client, auth_headers)[0]["is_focus"] is False


def test_grading_keeps_focus_while_topic_is_incomplete(client, db_session, auth_headers):
    _, questions = _topic_with_questions(db_session)
    _set_streaks(db_session, questions, [2, 0])
    _put(client, auth_headers)

    client.post(
        f"/api/v1/progress/questions/{questions[0].id}", json={"outcome": "richtig"}, headers=auth_headers
    )

    assert db_session.query(FocusTopic).count() == 1


def test_grading_question_without_topic_does_not_touch_focus(client, db_session, auth_headers):
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A", topic_id=None)
    db_session.add(question)
    db_session.commit()
    _set_streaks(db_session, [question], [2])

    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
    )
    assert response.status_code == 200


def test_deleting_a_user_removes_their_focus_topics(db_session):
    topic, _ = _topic_with_questions(db_session)
    user = User(email="leaving@example.com")
    db_session.add(user)
    db_session.commit()
    db_session.add(FocusTopic(user_id=user.id, topic_id=topic.id))
    db_session.commit()

    delete_user_and_progress(db_session, user)

    assert db_session.query(FocusTopic).count() == 0
