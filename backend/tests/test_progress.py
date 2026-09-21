from datetime import UTC, datetime, timedelta

import pytest

from app.core.jwt import create_access_token
from app.core.progress import (
    MAX_HALF_LIFE_DAYS,
    due_at,
    is_learned,
    next_half_life,
    progress_fraction,
    recall_probability,
)
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from tests.helpers import progress_state


def _fixture_user(db_session) -> User:
    return db_session.query(User).filter_by(email="fixture-user@example.com").one()


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
            QuestionProgress(user_id=user.id, question_id=questions[0].id, **progress_state(0)),
            QuestionProgress(user_id=user.id, question_id=questions[1].id, **progress_state(2)),
            QuestionProgress(user_id=user.id, question_id=questions[2].id, **progress_state(3)),
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
    db_session.add(QuestionProgress(user_id=other_user.id, question_id=question.id, **progress_state(3)))
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


def test_recall_probability_halves_every_half_life():
    assert recall_probability(4.0, 0) == 1.0
    assert recall_probability(4.0, 4) == pytest.approx(0.5)
    assert recall_probability(4.0, 8) == pytest.approx(0.25)
    assert recall_probability(4.0, -1) == 1.0


def test_next_half_life_first_richtig_gets_the_full_gain():
    assert next_half_life(1.0, None, "richtig") == 2.5


def test_next_half_life_gain_scales_with_the_spacing():
    # Re-answering right away proves nothing; waiting a full half-life earns the full gain.
    assert next_half_life(4.0, 0.0, "richtig") == pytest.approx(4.0)
    assert next_half_life(4.0, 2.0, "richtig") == pytest.approx(7.0)
    assert next_half_life(4.0, 4.0, "richtig") == pytest.approx(10.0)
    assert next_half_life(4.0, 40.0, "richtig") == pytest.approx(10.0)


def test_next_half_life_setbacks_and_bounds():
    assert next_half_life(4.0, 4.0, "teilweise_richtig") == 2.0
    assert next_half_life(4.0, 4.0, "falsch") == 1.0
    assert next_half_life(0.3, 1.0, "falsch") == 0.25
    assert next_half_life(MAX_HALF_LIFE_DAYS, 999.0, "richtig") == MAX_HALF_LIFE_DAYS


def test_due_at_is_when_recall_drops_to_the_threshold():
    graded = datetime(2026, 1, 1, tzinfo=UTC)
    # 0.7 recall probability after log2(1/0.7) ≈ 0.515 half-lives.
    assert due_at(graded, 10.0) - graded == pytest.approx(timedelta(days=5.146), abs=timedelta(minutes=5))


def test_is_learned_needs_a_long_half_life_and_recent_grading():
    now = datetime.now(UTC)
    assert is_learned(QuestionProgress(**progress_state(3)), now)
    assert not is_learned(QuestionProgress(**progress_state(2)), now)
    # A learned question whose recall probability decayed below the threshold resurfaces.
    assert not is_learned(QuestionProgress(**progress_state(3, graded_days_ago=30)), now)


def test_is_learned_accepts_naive_timestamps_from_sqlite():
    row = QuestionProgress(**progress_state(3))
    row.review_due_at = row.review_due_at.replace(tzinfo=None)
    assert is_learned(row, datetime.now(UTC))


def test_progress_fraction_is_a_position_that_only_reaches_one_when_learned():
    now = datetime.now(UTC)
    assert progress_fraction(QuestionProgress(**progress_state(0)), now) == 0.0
    assert 0 < progress_fraction(QuestionProgress(**progress_state(1)), now) < 1
    assert progress_fraction(QuestionProgress(**progress_state(2)), now) < 1
    assert progress_fraction(QuestionProgress(**progress_state(3)), now) == 1.0
    assert progress_fraction(QuestionProgress(**progress_state(3, graded_days_ago=30)), now) == 0.95


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


def test_grade_question_moves_the_half_life(client, db_session, auth_headers):
    question = _question(db_session)
    url = f"/api/v1/progress/questions/{question.id}"

    def grade(outcome):
        response = client.post(url, json={"outcome": outcome}, headers=auth_headers)
        assert response.status_code == 200
        db_session.expire_all()
        row = db_session.query(QuestionProgress).one()  # one row per (user, question)
        return row.half_life_days, response.json()

    half_life, body = grade("richtig")
    assert half_life == 2.5
    assert 0 < body["progress"] < 1 and body["learned"] is False
    # Answering right again immediately earns (almost) nothing: no spacing, no growth.
    half_life, _ = grade("richtig")
    assert half_life == pytest.approx(2.5, abs=0.01)
    assert grade("teilweise_richtig")[0] == pytest.approx(1.25, abs=0.01)
    assert grade("falsch")[0] == pytest.approx(0.3125, abs=0.01)
    assert grade("falsch")[0] == 0.25


def test_grade_question_becomes_learned_with_spacing(client, db_session, auth_headers):
    question = _question(db_session)
    user = _fixture_user(db_session)
    # Answered right twice before, the last time a week ago.
    db_session.add(
        QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(2, graded_days_ago=7))
    )
    db_session.commit()

    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
    )

    assert response.json() == {"question_id": question.id, "progress": 1.0, "learned": True}


def test_grade_question_counts_towards_the_summary(client, db_session, auth_headers):
    topic = Topic(subject="navigation", slug="nav", name="Navigation", display_order=1)
    db_session.add(topic)
    db_session.commit()
    question = Question(
        subject="navigation", number=1, question_text="Q?", answer_text="A", topic_id=topic.id
    )
    db_session.add(question)
    db_session.commit()

    user = _fixture_user(db_session)
    db_session.add(
        QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(2, graded_days_ago=7))
    )
    db_session.commit()
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
            QuestionProgress(user_id=user.id, question_id=questions[2].id, **progress_state(3)),
            QuestionProgress(user_id=user.id, question_id=questions[0].id, **progress_state(1)),
            QuestionProgress(user_id=other_user.id, question_id=questions[1].id, **progress_state(2)),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/progress/questions", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == [
        {"question_id": questions[0].id, "progress": pytest.approx(0.4709, abs=0.001), "learned": False},
        {"question_id": questions[2].id, "progress": 1.0, "learned": True},
    ]


def test_grade_question_survives_a_concurrent_first_grading(client, db_session, auth_headers, monkeypatch):
    # Simulates a double submit: another request inserted the row between
    # this request's lookup and its insert.
    from app.api.v1 import progress as progress_api

    question = _question(db_session)
    user = _fixture_user(db_session)
    db_session.add(
        QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1, graded_days_ago=3))
    )
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
    # Applied on top of the racing row: 2.5 days, graded 3 days ago -> full gain.
    assert db_session.query(QuestionProgress).one().half_life_days == pytest.approx(6.25)


def test_grade_question_409_when_the_racing_row_vanished(client, db_session, auth_headers, monkeypatch):
    from app.api.v1 import progress as progress_api

    question = _question(db_session)
    user = _fixture_user(db_session)
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1)))
    db_session.commit()
    # The row exists (so the insert collides) but every lookup misses it.
    monkeypatch.setattr(progress_api, "_progress_row", lambda db, user_id, question_id: None)

    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
    )

    assert response.status_code == 409
