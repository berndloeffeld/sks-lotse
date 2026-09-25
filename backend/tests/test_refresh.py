from datetime import UTC, datetime, timedelta

from app.core.progress import LEARNED_HALF_LIFE_DAYS, REFRESH_SESSION_SIZE, REFRESH_WINDOW_DAYS
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from tests.helpers import fixture_user, progress_state

URL = "/api/v1/progress/refresh/questions"
# Level 3 = half-life 15.6 days, due 8.05 days after the last grading.
LAPSED = {"level": 3, "graded_days_ago": 10}
DUE_TOMORROW = {"level": 3, "graded_days_ago": 7.05}
DUE_IN_THREE_DAYS = {"level": 3, "graded_days_ago": 5.05}


def _questions(db_session, count, subject="navigation"):
    topic = Topic(subject=subject, slug=subject, name=subject.title(), display_order=1)
    db_session.add(topic)
    db_session.commit()
    questions = [
        Question(subject=subject, number=n, question_text=f"Q{n}?", answer_text="A", topic_id=topic.id)
        for n in range(1, count + 1)
    ]
    db_session.add_all(questions)
    db_session.commit()
    return questions


def _grade(db_session, question, *, level, graded_days_ago):
    user = fixture_user(db_session)
    db_session.add(
        QuestionProgress(
            user_id=user.id,
            question_id=question.id,
            **progress_state(level, graded_days_ago=graded_days_ago),
        )
    )
    db_session.commit()


def _ids(client, headers):
    response = client.get(URL, headers=headers)
    assert response.status_code == 200
    return {q["id"] for q in response.json()}


def test_refresh_session_holds_lapsed_and_soon_lapsing_questions(client, db_session, auth_headers):
    lapsed, tomorrow, later, unseen = _questions(db_session, 4)
    _grade(db_session, lapsed, **LAPSED)
    _grade(db_session, tomorrow, **DUE_TOMORROW)
    _grade(db_session, later, **DUE_IN_THREE_DAYS)

    assert _ids(client, auth_headers) == {lapsed.id, tomorrow.id}
    assert unseen.id not in _ids(client, auth_headers)


def test_refresh_session_skips_questions_that_were_never_gelernt(client, db_session, auth_headers):
    (question,) = _questions(db_session, 1)
    # Half-life 6.25 days (two "Richtig"): on the way, not gelernt, and long overdue.
    _grade(db_session, question, level=2, graded_days_ago=30)

    assert _ids(client, auth_headers) == set()


def test_refresh_session_keeps_the_learners_own_questions_only(client, db_session, auth_headers):
    (question,) = _questions(db_session, 1)
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    db_session.add(QuestionProgress(user_id=other.id, question_id=question.id, **progress_state(**LAPSED)))
    db_session.commit()

    assert _ids(client, auth_headers) == set()


def test_refresh_session_is_capped(client, db_session, auth_headers):
    for question in _questions(db_session, REFRESH_SESSION_SIZE + 5):
        _grade(db_session, question, **LAPSED)

    assert len(client.get(URL, headers=auth_headers).json()) == REFRESH_SESSION_SIZE


def test_refresh_session_respects_the_exam_variant(client, db_session, auth_headers):
    (segeln,) = _questions(db_session, 1, subject="seemannschaft_segeln")
    _grade(db_session, segeln, **LAPSED)
    user = fixture_user(db_session)
    user.exam_variant = "motor"
    db_session.commit()

    assert _ids(client, auth_headers) == set()


def test_refresh_window_and_half_life_edges(client, db_session, auth_headers):
    at_bar, below_bar, inside, outside = _questions(db_session, 4)
    user = fixture_user(db_session)
    now = datetime.now(UTC)
    rows = [
        (at_bar, LEARNED_HALF_LIFE_DAYS, now - timedelta(hours=1)),
        (below_bar, LEARNED_HALF_LIFE_DAYS - 0.01, now - timedelta(hours=1)),
        (inside, 20.0, now + timedelta(days=REFRESH_WINDOW_DAYS - 0.1)),
        (outside, 20.0, now + timedelta(days=REFRESH_WINDOW_DAYS + 0.1)),
    ]
    db_session.add_all(
        QuestionProgress(
            user_id=user.id, question_id=q.id, half_life_days=h, last_graded_at=now, review_due_at=due
        )
        for q, h, due in rows
    )
    db_session.commit()

    assert _ids(client, auth_headers) == {at_bar.id, inside.id}


SUMMARY_URL = "/api/v1/progress/refresh/summary"


def test_refresh_summary_counts_lapsed_expiring_and_fresh(client, db_session, auth_headers):
    lapsed, tomorrow, later, on_the_way, _unseen = _questions(db_session, 5)
    _grade(db_session, lapsed, **LAPSED)
    _grade(db_session, tomorrow, **DUE_TOMORROW)
    _grade(db_session, later, **DUE_IN_THREE_DAYS)
    _grade(db_session, on_the_way, level=2, graded_days_ago=30)

    response = client.get(SUMMARY_URL, headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"lapsed": 1, "expiring": 1, "fresh": 1}


def test_refresh_summary_is_zero_without_progress(client, db_session, auth_headers):
    assert client.get(SUMMARY_URL, headers=auth_headers).json() == {"lapsed": 0, "expiring": 0, "fresh": 0}


def test_refresh_summary_respects_the_exam_variant_and_the_learner(client, db_session, auth_headers):
    (segeln,) = _questions(db_session, 1, subject="seemannschaft_segeln")
    _grade(db_session, segeln, **LAPSED)
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    (nav,) = _questions(db_session, 1, subject="navigation")
    db_session.add(QuestionProgress(user_id=other.id, question_id=nav.id, **progress_state(**LAPSED)))
    user = fixture_user(db_session)
    user.exam_variant = "motor"
    db_session.commit()

    assert client.get(SUMMARY_URL, headers=auth_headers).json() == {"lapsed": 0, "expiring": 0, "fresh": 0}
