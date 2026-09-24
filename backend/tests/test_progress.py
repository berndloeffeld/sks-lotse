from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.core.jwt import create_access_token
from app.core.progress import (
    FULL_GAIN,
    INITIAL_HALF_LIFE_DAYS,
    LEARNED_HALF_LIFE_DAYS,
    MAX_HALF_LIFE_DAYS,
    MIN_HALF_LIFE_DAYS,
    apply_grading,
    due_at,
    is_learned,
    learned_clause,
    learning_clause,
    next_half_life,
    progress_fraction,
)
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from tests.helpers import fixture_user, progress_state


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

    user = fixture_user(db_session)
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

    user = fixture_user(db_session)
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


def test_apply_grading_starts_a_streak_on_the_first_richtig():
    now = datetime.now(UTC)
    row = QuestionProgress(half_life_days=INITIAL_HALF_LIFE_DAYS, last_graded_at=now)
    apply_grading(row, "richtig", now, is_new=True)
    assert row.streak_start_at == now


def test_apply_grading_second_richtig_in_a_streak_is_unaffected_by_cumulative_spacing():
    # The streak's own 2nd "Richtig" has streak_start_at == the previous grading, so
    # cumulative and per-step spacing agree here — "two Richtig is never enough" (docs/
    # adr/0034-...) stays true regardless of docs/adr/0039-cumulative-spacing-....
    now = datetime.now(UTC)
    row = QuestionProgress(half_life_days=INITIAL_HALF_LIFE_DAYS, last_graded_at=now)
    apply_grading(row, "richtig", now, is_new=True)
    fully_spaced = now + timedelta(days=row.half_life_days)
    apply_grading(row, "richtig", fully_spaced, is_new=False)
    assert row.half_life_days == pytest.approx(INITIAL_HALF_LIFE_DAYS * FULL_GAIN**2)
    assert row.half_life_days < LEARNED_HALF_LIFE_DAYS


def test_apply_grading_setback_resets_the_streak():
    now = datetime.now(UTC)
    row = QuestionProgress(half_life_days=INITIAL_HALF_LIFE_DAYS, last_graded_at=now)
    apply_grading(row, "richtig", now, is_new=True)
    assert row.streak_start_at is not None
    apply_grading(row, "falsch", now + timedelta(days=1), is_new=False)
    assert row.streak_start_at is None
    # The next "Richtig" starts a fresh streak, measured from this setback, not
    # from the (now irrelevant) earlier one.
    apply_grading(row, "richtig", now + timedelta(days=2), is_new=False)
    assert row.streak_start_at == now + timedelta(days=2)


def test_apply_grading_streak_spacing_is_cumulative_not_per_step():
    # A run of four quick "Richtig" after a setback (docs/adr/0039-...) earns more
    # credit than if each were judged only against the grading right before it —
    # the "Frage 3" scenario from the redesign: h ends at ~6.4 days instead of ~3.6.
    base = datetime(2026, 1, 1, tzinfo=UTC)
    row = QuestionProgress(half_life_days=MIN_HALF_LIFE_DAYS, last_graded_at=base + timedelta(days=6.5))
    for day in (9.0, 9.5, 10.5, 11.0):
        apply_grading(row, "richtig", base + timedelta(days=day), is_new=False)
    assert row.half_life_days == pytest.approx(6.437, abs=0.001)
    assert row.streak_start_at == base + timedelta(days=9.0)

    per_step = MIN_HALF_LIFE_DAYS
    previous_day = 6.5
    for day in (9.0, 9.5, 10.5, 11.0):
        per_step = next_half_life(per_step, day - previous_day, "richtig")
        previous_day = day
    assert per_step == pytest.approx(3.625, abs=0.001)
    assert row.half_life_days > per_step


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


def _count_where(db_session, clause) -> int:
    return db_session.execute(select(func.count()).select_from(QuestionProgress).where(clause)).scalar_one()


def test_sql_clauses_agree_with_is_learned_incl_decayed_questions(db_session):
    # learned_clause is the SQL twin of is_learned(): a question with a long half-life whose recall
    # has decayed below the threshold (due date passed) must NOT count as gelernt, but as "learning".
    user = User(email="clauses@example.com")
    db_session.add(user)
    questions = [
        Question(subject="navigation", number=n, question_text="Q?", answer_text="A") for n in range(1, 5)
    ]
    db_session.add_all(questions)
    db_session.commit()
    states = [
        progress_state(3),  # gelernt
        progress_state(3, graded_days_ago=30),  # long half-life, but decayed
        progress_state(2),  # on the way
        progress_state(0),  # just failed
    ]
    for question, state in zip(questions, states, strict=True):
        db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **state))
    db_session.commit()

    now = datetime.now(UTC)
    assert _count_where(db_session, learned_clause(now)) == 1
    assert _count_where(db_session, learning_clause(now)) == 2  # decayed + on the way, not the failed one


def test_gelernt_starts_exactly_at_the_learned_half_life(db_session):
    # "Gelernt" is half-life >= 7 days, so exactly 7.0 counts; exactly the initial half-life
    # (never answered right) is not yet "learning" — in Python and in its SQL twin alike.
    user = User(email="boundary@example.com")
    db_session.add(user)
    questions = [
        Question(subject="navigation", number=n, question_text="Q?", answer_text="A") for n in (1, 2)
    ]
    db_session.add_all(questions)
    db_session.commit()
    now = datetime.now(UTC)
    at_learned = {"half_life_days": LEARNED_HALF_LIFE_DAYS, "last_graded_at": now}
    at_initial = {"half_life_days": INITIAL_HALF_LIFE_DAYS, "last_graded_at": now}
    rows = [
        QuestionProgress(user_id=user.id, question_id=q.id, review_due_at=now + timedelta(days=1), **state)
        for q, state in zip(questions, (at_learned, at_initial), strict=True)
    ]
    db_session.add_all(rows)
    db_session.commit()

    assert is_learned(rows[0], now)
    assert _count_where(db_session, learned_clause(now)) == 1
    assert _count_where(db_session, learning_clause(now)) == 0


def test_progress_fraction_is_a_position_that_only_reaches_one_when_learned():
    now = datetime.now(UTC)
    assert progress_fraction(QuestionProgress(**progress_state(0)), now) == 0.0
    assert 0 < progress_fraction(QuestionProgress(**progress_state(1)), now) < 1
    assert progress_fraction(QuestionProgress(**progress_state(2)), now) < 1
    assert progress_fraction(QuestionProgress(**progress_state(3)), now) == 1.0
    assert progress_fraction(QuestionProgress(**progress_state(3, graded_days_ago=30)), now) == 0.95


def test_progress_fraction_moves_on_a_richtig_after_a_setback():
    # From the floor (0.25 days) a "Richtig" reaches at most 0.625 days — below the initial half-life,
    # yet the boat must still sail.
    now = datetime.now(UTC)
    row = QuestionProgress(**progress_state(0))
    before = progress_fraction(row, now)
    apply_grading(row, "richtig", now + timedelta(days=1), is_new=False)
    assert progress_fraction(row, now + timedelta(days=1)) > before


def _question(db_session) -> Question:
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    return question


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


def test_grade_question_records_the_last_correct_answer_only_for_richtig(client, db_session, auth_headers):
    question = _question(db_session)
    url = f"/api/v1/progress/questions/{question.id}"

    def last_correct():
        db_session.expire_all()
        return db_session.query(QuestionProgress).one().last_correct_at

    client.post(url, json={"outcome": "falsch"}, headers=auth_headers)
    assert last_correct() is None
    client.post(url, json={"outcome": "richtig"}, headers=auth_headers)
    first = last_correct()
    assert first is not None
    client.post(url, json={"outcome": "teilweise_richtig"}, headers=auth_headers)
    assert last_correct() == first


def test_grade_question_becomes_learned_with_spacing(client, db_session, auth_headers):
    question = _question(db_session)
    user = fixture_user(db_session)
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

    user = fixture_user(db_session)
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
    user = fixture_user(db_session)
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
        {"question_id": questions[0].id, "progress": pytest.approx(0.6910, abs=0.001), "learned": False},
        {"question_id": questions[2].id, "progress": 1.0, "learned": True},
    ]


def test_grade_question_survives_a_concurrent_first_grading(client, db_session, auth_headers, monkeypatch):
    # Simulates a double submit: another request inserted the row between
    # this request's lookup and its insert.
    from app.services import progress as progress_api

    question = _question(db_session)
    user = fixture_user(db_session)
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
    from app.services import progress as progress_api

    question = _question(db_session)
    user = fixture_user(db_session)
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1)))
    db_session.commit()
    # The row exists (so the insert collides) but every lookup misses it.
    monkeypatch.setattr(progress_api, "_progress_row", lambda db, user_id, question_id: None)

    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
    )

    assert response.status_code == 409


def test_grading_only_touches_the_callers_own_progress_row(client, db_session, auth_headers):
    question = _question(db_session)
    me = fixture_user(db_session)
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    theirs = QuestionProgress(user_id=other.id, question_id=question.id, **progress_state(2))
    db_session.add(theirs)
    db_session.commit()
    before = (theirs.half_life_days, theirs.last_graded_at)

    response = client.post(
        f"/api/v1/progress/questions/{question.id}", json={"outcome": "richtig"}, headers=auth_headers
    )

    assert response.status_code == 200
    db_session.refresh(theirs)
    assert (theirs.half_life_days, theirs.last_graded_at) == before
    assert db_session.query(QuestionProgress).filter_by(user_id=me.id).count() == 1


def test_focus_topic_lookup_needs_both_subject_and_slug(client, db_session, auth_headers):
    db_session.add(Topic(subject="navigation", slug="nav", name="Navigation", display_order=1))
    db_session.commit()

    response = client.put("/api/v1/progress/focus/wetterkunde/nav", headers=auth_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Topic not found"}


def test_summary_lists_a_topic_without_questions_as_empty(client, db_session, auth_headers):
    db_session.add(Topic(subject="navigation", slug="leer", name="Leer", display_order=1))
    db_session.commit()

    [row] = client.get("/api/v1/progress/summary", headers=auth_headers).json()

    assert (row["total_questions"], row["learned_questions"], row["learning_questions"]) == (0, 0, 0)
