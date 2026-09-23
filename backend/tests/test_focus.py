from app.core.jwt import create_access_token
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from app.services.focus import is_topic_fully_learned, remove_focus_if_topic_learned
from app.services.user import delete_user_and_progress
from tests.helpers import progress_state


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
        QuestionProgress(user_id=user.id, question_id=q.id, **progress_state(s, graded_days_ago=7))
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


def _session(client, headers):
    return client.get("/api/v1/progress/focus/questions", headers=headers)


def _grade_at(db_session, question, *, level, correct_days_ago):
    """Progress whose last grading was ``correct_days_ago``; None = never graded "Richtig"."""
    user = _fixture_user(db_session)
    state = progress_state(level, graded_days_ago=correct_days_ago or 0)
    last_correct = state["last_graded_at"] if correct_days_ago is not None else None
    db_session.add(
        QuestionProgress(user_id=user.id, question_id=question.id, last_correct_at=last_correct, **state)
    )
    db_session.commit()


def test_focus_session_requires_auth(client):
    assert client.get("/api/v1/progress/focus/questions").status_code == 401


def test_focus_session_is_empty_without_focus_topics(client, db_session, auth_headers):
    _topic_with_questions(db_session)

    response = _session(client, auth_headers)

    assert response.status_code == 200
    assert response.json() == []


def test_focus_session_orders_by_last_correct_answer_across_topics(client, db_session, auth_headers):
    _, nav = _topic_with_questions(db_session, count=2, subject="navigation", slug="nav")
    _, wetter = _topic_with_questions(db_session, count=2, subject="wetterkunde", slug="wetter")
    _topic_with_questions(db_session, count=1, subject="schifffahrtsrecht", slug="nicht-fokus")
    _grade_at(db_session, nav[0], level=1, correct_days_ago=2)
    _grade_at(db_session, wetter[0], level=1, correct_days_ago=5)
    _grade_at(db_session, wetter[1], level=1, correct_days_ago=3)
    # nav[1] was never graded
    _put(client, auth_headers, "navigation", "nav")
    _put(client, auth_headers, "wetterkunde", "wetter")

    ids = [q["id"] for q in _session(client, auth_headers).json()]

    assert ids == [nav[1].id, wetter[0].id, wetter[1].id, nav[0].id]


def test_focus_session_starts_with_never_answered_questions(client, db_session, auth_headers):
    _, questions = _topic_with_questions(db_session, count=3)
    # The lowest id was answered "Falsch"; the two others were never answered.
    _grade_at(db_session, questions[0], level=0, correct_days_ago=None)
    _put(client, auth_headers)

    ids = [q["id"] for q in _session(client, auth_headers).json()]

    assert ids == [questions[1].id, questions[2].id, questions[0].id]


def test_focus_session_puts_wrong_answers_before_correct_ones_and_skips_learned(
    client, db_session, auth_headers
):
    _, questions = _topic_with_questions(db_session, count=3)
    user = _fixture_user(db_session)
    # Graded "Falsch" yesterday (never correct), "Richtig" 10 days ago, and gelernt.
    _grade_at(db_session, questions[0], level=0, correct_days_ago=None)
    _grade_at(db_session, questions[1], level=1, correct_days_ago=10)
    db_session.add(QuestionProgress(user_id=user.id, question_id=questions[2].id, **progress_state(3)))
    db_session.commit()
    _put(client, auth_headers)

    ids = [q["id"] for q in _session(client, auth_headers).json()]

    assert ids == [questions[0].id, questions[1].id]


def test_focus_session_is_scoped_to_the_user_and_the_exam_variant(client, db_session, auth_headers):
    _, mine = _topic_with_questions(db_session, count=1)
    _, sail = _topic_with_questions(db_session, count=1, subject="seemannschaft_segeln", slug="rigg")
    user = _fixture_user(db_session)
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    db_session.add_all(
        FocusTopic(user_id=uid, topic_id=topic_id)
        for uid, topic_id in [
            (user.id, mine[0].topic_id),
            (user.id, sail[0].topic_id),
            (other.id, sail[0].topic_id),
        ]
    )
    user.exam_variant = "motor"
    db_session.commit()

    ids = [q["id"] for q in _session(client, auth_headers).json()]

    assert ids == [mine[0].id]


def test_topic_learned_check_counts_only_this_user_and_this_topic(db_session):
    topic, questions = _topic_with_questions(db_session, count=2)
    _, elsewhere = _topic_with_questions(db_session, count=2, subject="wetterkunde", slug="wet")
    me, other = User(email="me@example.com"), User(email="other@example.com")
    db_session.add_all([me, other])
    db_session.commit()
    learned = progress_state(3)
    db_session.add_all(
        [
            QuestionProgress(user_id=me.id, question_id=questions[0].id, **learned),
            # Neither the other learner's progress on this topic nor mine on another topic may count.
            QuestionProgress(user_id=other.id, question_id=questions[1].id, **learned),
            *(QuestionProgress(user_id=me.id, question_id=q.id, **learned) for q in elsewhere),
        ]
    )
    db_session.commit()

    assert not is_topic_fully_learned(db_session, me.id, topic.id)

    db_session.add(QuestionProgress(user_id=me.id, question_id=questions[1].id, **learned))
    db_session.commit()
    assert is_topic_fully_learned(db_session, me.id, topic.id)


def test_learned_topic_only_loses_the_focus_mark_of_the_learner_who_learned_it(db_session):
    topic, questions = _topic_with_questions(db_session, count=1)
    _, elsewhere = _topic_with_questions(db_session, count=1, subject="wetterkunde", slug="wet")
    me, other = User(email="me@example.com"), User(email="other@example.com")
    db_session.add_all([me, other])
    db_session.commit()
    db_session.add_all(
        [
            QuestionProgress(user_id=me.id, question_id=questions[0].id, **progress_state(3)),
            FocusTopic(user_id=me.id, topic_id=topic.id),
            FocusTopic(user_id=other.id, topic_id=topic.id),  # same topic, another learner
            FocusTopic(user_id=me.id, topic_id=elsewhere[0].topic_id),  # another topic, same learner
        ]
    )
    db_session.commit()

    remove_focus_if_topic_learned(db_session, me.id, topic.id)

    remaining = {(f.user_id, f.topic_id) for f in db_session.query(FocusTopic)}
    assert remaining == {(other.id, topic.id), (me.id, elsewhere[0].topic_id)}


def test_crediting_an_exam_grades_every_question_in_one_go_and_checks_each_topic_once(
    db_session, auth_headers, monkeypatch
):
    from datetime import UTC, datetime

    from app.services import progress as progress_service

    topic, questions = _topic_with_questions(db_session, count=3)
    user = _fixture_user(db_session)
    # One question already has progress, two don't — both paths in one batch.
    db_session.add(
        QuestionProgress(user_id=user.id, question_id=questions[0].id, **progress_state(1, graded_days_ago=3))
    )
    db_session.add(FocusTopic(user_id=user.id, topic_id=topic.id))
    db_session.commit()
    checked = []
    real_remove = progress_service.remove_focus_if_topic_learned
    monkeypatch.setattr(
        progress_service,
        "remove_focus_if_topic_learned",
        lambda db, uid, tid: checked.append(tid) or real_remove(db, uid, tid),
    )
    # Pretend every graded question is now learned, so the topic check must run — once.
    monkeypatch.setattr(progress_service, "is_learned", lambda row, now: True)

    progress_service.credit_correct_answers(
        db_session, user.id, [q.id for q in questions] + [questions[0].id, 999_999], datetime.now(UTC)
    )

    rows = db_session.query(QuestionProgress).filter_by(user_id=user.id).all()
    assert sorted(r.question_id for r in rows) == sorted(q.id for q in questions)
    assert all(r.last_correct_at is not None for r in rows)
    assert checked == [topic.id]


def test_crediting_nothing_touches_nothing(db_session, auth_headers):
    from datetime import UTC, datetime

    from app.services.progress import credit_correct_answers

    credit_correct_answers(db_session, _fixture_user(db_session).id, [], datetime.now(UTC))

    assert db_session.query(QuestionProgress).count() == 0


def test_crediting_falls_back_to_one_by_one_when_a_row_appeared_concurrently(
    db_session, auth_headers, monkeypatch
):
    from datetime import UTC, datetime

    from sqlalchemy.exc import IntegrityError

    from app.services import progress as progress_service

    _, questions = _topic_with_questions(db_session, count=2)
    user = _fixture_user(db_session)
    real_flush = db_session.flush
    flushes = []

    def racing_flush(*args, **kwargs):
        # Only the flush that writes the new progress rows loses the race (not the autoflushes
        # of the queries before it).
        if not flushes and any(isinstance(obj, QuestionProgress) for obj in db_session.new):
            flushes.append(True)
            raise IntegrityError("INSERT", {}, Exception("duplicate key"))
        return real_flush(*args, **kwargs)

    monkeypatch.setattr(db_session, "flush", racing_flush)
    graded = []
    monkeypatch.setattr(
        progress_service, "record_grading", lambda db, uid, q, outcome, now: graded.append((q.id, outcome))
    )

    progress_service.credit_correct_answers(db_session, user.id, [q.id for q in questions], datetime.now(UTC))

    assert flushes == [True]
    assert sorted(graded) == sorted((q.id, "richtig") for q in questions)
