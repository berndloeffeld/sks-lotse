from datetime import UTC, datetime, timedelta, timezone

from app.core.config import settings
from app.core.exam import QUESTIONS_PER_GROUP, SUBJECT_GROUPS, as_utc, result_for
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.user import User

_FIXTURE_EMAIL = "fixture-user@example.com"
_POOL = {
    "navigation": 12,
    "schifffahrtsrecht": 10,
    "wetterkunde": 8,
    "seemannschaft_allgemein": 8,
    "seemannschaft_segeln": 6,
    "seemannschaft_motor": 6,
}


def _fixture_user(db_session) -> User:
    return db_session.query(User).filter_by(email=_FIXTURE_EMAIL).one()


def _seed(db_session, variant: str | None = "segeln_und_motor") -> User:
    for subject, count in _POOL.items():
        for number in range(1, count + 1):
            db_session.add(
                Question(
                    subject=subject,
                    number=number,
                    question_text=f"Frage {subject} {number}",
                    answer_text=f"Amtliche Antwort {subject} {number}",
                )
            )
    user = _fixture_user(db_session)
    user.exam_variant = variant
    db_session.commit()
    return user


def _start(client, auth_headers):
    response = client.post("/api/v1/exams", headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


def _answer_and_submit(client, auth_headers, exam):
    for question in exam["questions"]:
        client.put(
            f"/api/v1/exams/{exam['id']}/questions/{question['position']}/answer",
            json={"answer_text": f"Meine Antwort {question['position']}"},
            headers=auth_headers,
        )
    return client.post(f"/api/v1/exams/{exam['id']}/submit", headers=auth_headers).json()


def _grade_all(client, auth_headers, exam, outcomes):
    body = None
    for question, outcome in zip(exam["questions"], outcomes, strict=True):
        response = client.put(
            f"/api/v1/exams/{exam['id']}/questions/{question['position']}/grade",
            json={"outcome": outcome},
            headers=auth_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
    return body


def test_exam_routes_require_authentication(client):
    assert client.post("/api/v1/exams").status_code == 401
    assert client.get("/api/v1/exams").status_code == 401
    assert client.get("/api/v1/exams/stats").status_code == 401
    assert client.get("/api/v1/exams/1").status_code == 401
    assert client.put("/api/v1/exams/1/questions/1/answer", json={"answer_text": "x"}).status_code == 401
    assert client.post("/api/v1/exams/1/submit").status_code == 401
    assert client.put("/api/v1/exams/1/questions/1/grade", json={"outcome": "richtig"}).status_code == 401
    assert client.delete("/api/v1/exams/1").status_code == 401


def test_start_requires_exam_variant(client, db_session, auth_headers):
    _seed(db_session, variant=None)
    response = client.post("/api/v1/exams", headers=auth_headers)
    assert response.status_code == 400


def test_start_fails_when_catalog_too_small(client, db_session, auth_headers):
    user = _fixture_user(db_session)
    user.exam_variant = "motor"
    db_session.commit()
    assert client.post("/api/v1/exams", headers=auth_headers).status_code == 503


def test_start_composes_official_split_for_each_variant(client, db_session, auth_headers):
    user = _seed(db_session, variant="segeln_und_motor")
    exam = _start(client, auth_headers)
    assert exam["status"] == "in_progress"
    assert exam["question_count"] == 30
    counts = {}
    for q in exam["questions"]:
        counts[q["subject_group"]] = counts.get(q["subject_group"], 0) + 1
        assert q["subject"] != "seemannschaft_motor"
    assert counts == QUESTIONS_PER_GROUP
    assert [q["position"] for q in exam["questions"]] == list(range(1, 31))
    deadline = datetime.fromisoformat(exam["deadline_at"])
    started = datetime.fromisoformat(exam["started_at"])
    assert deadline - started == timedelta(minutes=90)

    # A finished exam keeps its variant snapshot; a new one follows the current variant.
    _answer_and_submit(client, auth_headers, exam)
    user.exam_variant = "motor"
    db_session.commit()
    motor_exam = _start(client, auth_headers)
    assert all(q["subject"] != "seemannschaft_segeln" for q in motor_exam["questions"])
    assert motor_exam["exam_variant"] == "motor"


def test_exam_is_random(client, db_session, auth_headers):
    _seed(db_session)
    orders = set()
    for _ in range(4):
        exam = _start(client, auth_headers)
        orders.add(tuple(q["question_id"] for q in exam["questions"]))
        client.delete(f"/api/v1/exams/{exam['id']}", headers=auth_headers)
    assert len(orders) > 1


def test_only_one_exam_in_progress(client, db_session, auth_headers):
    _seed(db_session)
    _start(client, auth_headers)
    assert client.post("/api/v1/exams", headers=auth_headers).status_code == 409


def test_parallel_start_is_rejected_by_the_database(client, db_session, auth_headers, monkeypatch):
    # Simulates two parallel starts: the application-level check sees no running
    # exam (as it would for the second request), so only the unique index stops it.
    from app.api.v1 import exams as exams_api

    _seed(db_session)
    _start(client, auth_headers)
    monkeypatch.setattr(exams_api, "_own_attempts", lambda db, user: [])

    response = client.post("/api/v1/exams", headers=auth_headers)

    assert response.status_code == 409
    assert db_session.query(ExamAttempt).count() == 1


def test_a_new_exam_can_start_once_the_previous_one_is_submitted(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    client.post(f"/api/v1/exams/{exam['id']}/submit", headers=auth_headers)

    assert client.post("/api/v1/exams", headers=auth_headers).status_code == 201


def test_exam_questions_carry_images_and_the_answer_ones_stay_hidden_until_submit(
    client, db_session, auth_headers
):
    _seed(db_session)
    question_image = {"src": "q.png", "width": 10, "height": 20}
    answer_image = {"src": "a.png", "width": 30, "height": 40}
    for question in db_session.query(Question):
        question.question_images = [question_image]
        question.answer_images = [answer_image]
    db_session.commit()

    exam = _start(client, auth_headers)
    assert all(q["question_images"] == [question_image] for q in exam["questions"])
    assert all(q["official_answer_images"] == [] for q in exam["questions"])

    _answer_and_submit(client, auth_headers, exam)
    exam = client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).json()
    assert all(q["official_answer_images"] == [answer_image] for q in exam["questions"])


def test_official_answers_hidden_until_submit(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    assert all(q["official_answer"] is None for q in exam["questions"])
    fetched = client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).json()
    assert all(q["official_answer"] is None for q in fetched["questions"])
    assert "Amtliche Antwort" not in client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).text

    submitted = _answer_and_submit(client, auth_headers, exam)
    assert submitted["status"] == "grading"
    assert all(q["official_answer"].startswith("Amtliche Antwort") for q in submitted["questions"])
    # No tips anywhere in the exam payload (ADR-0029).
    assert not any("tip" in key for q in submitted["questions"] for key in q)


def test_answers_are_saved_and_rejected_after_submit(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    url = f"/api/v1/exams/{exam['id']}/questions/3/answer"
    assert client.put(url, json={"answer_text": "erste"}, headers=auth_headers).status_code == 204
    assert client.put(url, json={"answer_text": "zweite"}, headers=auth_headers).status_code == 204
    fetched = client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).json()
    assert fetched["questions"][2]["answer_text"] == "zweite"
    assert fetched["answered_count"] == 1

    assert client.put(url, json={"answer_text": "x" * 10_001}, headers=auth_headers).status_code == 422
    missing = f"/api/v1/exams/{exam['id']}/questions/99/answer"
    assert client.put(missing, json={"answer_text": "x"}, headers=auth_headers).status_code == 404

    client.post(f"/api/v1/exams/{exam['id']}/submit", headers=auth_headers)
    assert client.put(url, json={"answer_text": "zu spät"}, headers=auth_headers).status_code == 409
    assert client.post(f"/api/v1/exams/{exam['id']}/submit", headers=auth_headers).status_code == 409


def test_deadline_auto_submits_exam(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    attempt = db_session.get(ExamAttempt, exam["id"])
    attempt.deadline_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    url = f"/api/v1/exams/{exam['id']}/questions/1/answer"
    assert client.put(url, json={"answer_text": "zu spät"}, headers=auth_headers).status_code == 409
    fetched = client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).json()
    assert fetched["status"] == "grading"
    assert fetched["timed_out"] is True
    assert fetched["questions"][0]["official_answer"] is not None
    # A new exam can be started once the old one has expired.
    assert client.post("/api/v1/exams", headers=auth_headers).status_code == 201


def test_expired_exam_is_submitted_when_listing(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    db_session.get(ExamAttempt, exam["id"]).deadline_at = datetime.now(UTC) - timedelta(minutes=5)
    db_session.commit()
    listed = client.get("/api/v1/exams", headers=auth_headers).json()
    assert listed[0]["status"] == "grading"
    assert listed[0]["timed_out"] is True


def test_grading_requires_submit_and_completes_exam(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    grade_url = f"/api/v1/exams/{exam['id']}/questions/1/grade"
    assert client.put(grade_url, json={"outcome": "richtig"}, headers=auth_headers).status_code == 409

    _answer_and_submit(client, auth_headers, exam)
    assert client.put(grade_url, json={"outcome": "sehr gut"}, headers=auth_headers).status_code == 422
    outcomes = ["richtig"] * 15 + ["teilweise_richtig"] * 10 + ["falsch"] * 5
    body = _grade_all(client, auth_headers, exam, outcomes)
    assert body["status"] == "completed"
    assert body["points"] == 40
    assert body["max_points"] == 60
    assert body["result"] == "bestanden"
    assert sum(g["points"] for g in body["group_scores"]) == 40
    assert client.put(grade_url, json={"outcome": "falsch"}, headers=auth_headers).status_code == 409


def test_partially_graded_exam_has_no_result_yet(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    _answer_and_submit(client, auth_headers, exam)
    response = client.put(
        f"/api/v1/exams/{exam['id']}/questions/1/grade", json={"outcome": "richtig"}, headers=auth_headers
    )
    body = response.json()
    assert body["status"] == "grading"
    assert body["points"] is None
    assert body["result"] is None
    assert body["group_scores"] is None


def test_result_thresholds():
    assert result_for(32) == "nicht_bestanden"
    assert result_for(33) == "muendliche_nachpruefung"
    assert result_for(38) == "muendliche_nachpruefung"
    assert result_for(39) == "bestanden"
    assert result_for(60) == "bestanden"


def test_other_users_exam_is_not_found(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    from app.core.jwt import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(other.id, other.token_version)}"}
    assert client.get(f"/api/v1/exams/{exam['id']}", headers=headers).status_code == 404
    assert client.post(f"/api/v1/exams/{exam['id']}/submit", headers=headers).status_code == 404
    assert client.delete(f"/api/v1/exams/{exam['id']}", headers=headers).status_code == 404
    assert client.get("/api/v1/exams", headers=headers).json() == []


def test_list_and_stats(client, db_session, auth_headers):
    _seed(db_session)
    empty = client.get("/api/v1/exams/stats", headers=auth_headers).json()
    assert empty["completed_count"] == 0
    assert empty["average_points"] is None
    assert empty["best_points"] is None

    scores = [["richtig"] * 20 + ["falsch"] * 10, ["falsch"] * 30]  # 40 and 0 points
    for outcomes in scores:
        exam = _start(client, auth_headers)
        _answer_and_submit(client, auth_headers, exam)
        _grade_all(client, auth_headers, exam, outcomes)
    running = _start(client, auth_headers)

    listed = client.get("/api/v1/exams", headers=auth_headers).json()
    assert next(e["id"] for e in listed) == running["id"]
    assert listed[0]["status"] == "in_progress"
    assert listed[0]["points"] is None

    stats = client.get("/api/v1/exams/stats", headers=auth_headers).json()
    assert stats["completed_count"] == 2
    assert stats["passed_count"] == 1
    assert stats["average_points"] == 20.0
    assert stats["best_points"] == 40
    assert [p["points"] for p in stats["recent"]] == [40, 0]
    assert sum(g["max_points"] for g in stats["group_scores"]) == 120


def test_delete_exam(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    assert client.delete(f"/api/v1/exams/{exam['id']}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).status_code == 404
    assert db_session.query(ExamAttemptQuestion).count() == 0


def test_removed_catalog_question_keeps_history(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    _answer_and_submit(client, auth_headers, exam)
    eq = db_session.query(ExamAttemptQuestion).filter_by(attempt_id=exam["id"], position=1).one()
    eq.question_id = None
    db_session.commit()
    first = client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).json()["questions"][0]
    assert first["question_text"] is None
    assert first["answer_text"] == "Meine Antwort 1"


def test_account_deletion_removes_exams(client, db_session, auth_headers):
    _seed(db_session)
    _start(client, auth_headers)
    assert client.delete("/api/v1/auth/me", headers=auth_headers).status_code == 204
    assert db_session.query(ExamAttempt).count() == 0
    assert db_session.query(ExamAttemptQuestion).count() == 0


def test_admin_export_includes_exams(client, db_session, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", _FIXTURE_EMAIL)
    user = _seed(db_session)
    exam = _start(client, auth_headers)
    _answer_and_submit(client, auth_headers, exam)
    export = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers).json()
    assert len(export["exam_attempts"]) == 1
    attempt = export["exam_attempts"][0]
    assert attempt["exam_id"] == exam["id"]
    assert len(attempt["questions"]) == 30
    assert attempt["questions"][0]["answer_text"] == "Meine Antwort 1"


def test_an_expired_exam_no_longer_blocks_a_new_start(client, db_session, auth_headers):
    _seed(db_session)
    expired = _start(client, auth_headers)
    attempt = db_session.get(ExamAttempt, expired["id"])
    attempt.deadline_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    assert client.post("/api/v1/exams", headers=auth_headers).status_code == 201

    old = next(
        e for e in client.get("/api/v1/exams", headers=auth_headers).json() if e["id"] == expired["id"]
    )
    assert old["status"] == "grading"
    assert old["timed_out"] is True


def test_stats_ignore_exams_that_are_not_fully_graded(client, db_session, auth_headers):
    _seed(db_session)
    graded = _answer_and_submit(client, auth_headers, _start(client, auth_headers))
    _grade_all(client, auth_headers, graded, ["richtig"] * 30)
    pending = _answer_and_submit(client, auth_headers, _start(client, auth_headers))
    client.put(
        f"/api/v1/exams/{pending['id']}/questions/1/grade", json={"outcome": "richtig"}, headers=auth_headers
    )
    _start(client, auth_headers)

    stats = client.get("/api/v1/exams/stats", headers=auth_headers).json()

    assert stats["completed_count"] == 1
    assert stats["best_points"] == 60
    assert [g["points"] for g in stats["group_scores"]] == [18, 14, 10, 18]


def test_as_utc_treats_naive_as_utc_and_leaves_aware_values_alone():
    # SQLite (tests) hands back naive datetimes, Postgres (production) aware ones.
    assert as_utc(datetime(2026, 1, 1, 12, 0)) == datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    plus_two = datetime(2026, 1, 1, 12, 0, tzinfo=timezone(timedelta(hours=2)))
    assert as_utc(plus_two) is plus_two
    assert as_utc(plus_two) == datetime(2026, 1, 1, 10, 0, tzinfo=UTC)


def test_exam_view_shows_each_question_with_its_catalog_source_and_grading(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    first = exam["questions"][0]
    assert first["subject"] == "navigation" and first["number"] >= 1
    assert first["question_text"] == f"Frage navigation {first['number']}"
    assert first["outcome"] is None and first["points"] is None

    _answer_and_submit(client, auth_headers, exam)
    _grade_all(client, auth_headers, exam, ["richtig"] * 30)
    body = client.get(f"/api/v1/exams/{exam['id']}", headers=auth_headers).json()

    assert all(q["outcome"] == "richtig" and q["points"] == 2 for q in body["questions"])
    assert all(q["official_answer"] for q in body["questions"])
    # 9 / 7 / 5 / 9 questions per subject group at 2 points each, all of them earned.
    assert {g["subject_group"]: (g["points"], g["max_points"]) for g in body["group_scores"]} == {
        "navigation": (18, 18),
        "schifffahrtsrecht": (14, 14),
        "wetterkunde": (10, 10),
        "seemannschaft": (18, 18),
    }


def test_only_my_own_unsubmitted_exam_blocks_starting_another(client, db_session, auth_headers):
    me = _seed(db_session)
    other = User(email="other@example.com", exam_variant="motor")
    db_session.add(other)
    db_session.commit()
    now = datetime.now(UTC)
    running = {"exam_variant": "motor", "started_at": now, "deadline_at": now + timedelta(minutes=90)}
    db_session.add_all(
        [
            ExamAttempt(user_id=other.id, **running),  # someone else's, still running
            ExamAttempt(user_id=me.id, submitted_at=now, **running),  # mine, but already submitted
        ]
    )
    db_session.commit()

    assert client.post("/api/v1/exams", headers=auth_headers).status_code == 201


def _graded_attempt(db_session, user, days_ago: int, richtig: int, teilweise: int = 0) -> None:
    """A graded exam: `richtig` right answers (2 points each), `teilweise` partial (1), the rest wrong."""
    started = datetime.now(UTC) - timedelta(days=days_ago)
    attempt = ExamAttempt(
        user_id=user.id,
        exam_variant="motor",
        started_at=started,
        deadline_at=started + timedelta(minutes=90),
        submitted_at=started + timedelta(minutes=60),
        graded_at=started + timedelta(minutes=70),
    )
    db_session.add(attempt)
    db_session.flush()
    groups = [g for g in SUBJECT_GROUPS for _ in range(QUESTIONS_PER_GROUP[g])]
    outcomes = ["richtig"] * richtig + ["teilweise_richtig"] * teilweise
    outcomes += ["falsch"] * (len(groups) - len(outcomes))
    db_session.add_all(
        ExamAttemptQuestion(attempt_id=attempt.id, position=i, subject_group=g, outcome=o)
        for i, (g, o) in enumerate(zip(groups, outcomes, strict=True), start=1)
    )


def test_stats_over_many_exams_count_passes_round_the_average_and_keep_the_last_ten(
    client, db_session, auth_headers
):
    empty = client.get("/api/v1/exams/stats", headers=auth_headers).json()
    assert [(g["points"], g["max_points"]) for g in empty["group_scores"]] == [(0, 0)] * 4

    user = _seed(db_session)
    # Oldest first, in points: 60, 0, 60, 0, 60, 0, 60, 0, 59, 0, 0, 2 — five passes, seven not.
    shapes = [(30, 0), (0, 0)] * 4 + [(29, 1), (0, 0), (0, 0), (0, 2)]
    for index, (richtig, teilweise) in enumerate(shapes):
        _graded_attempt(db_session, user, days_ago=len(shapes) - index, richtig=richtig, teilweise=teilweise)
    db_session.commit()

    stats = client.get("/api/v1/exams/stats", headers=auth_headers).json()

    assert stats["completed_count"] == 12
    assert stats["passed_count"] == 5
    assert stats["average_points"] == 25.1  # 301 / 12 = 25.083...
    assert stats["best_points"] == 60
    assert [p["points"] for p in stats["recent"]] == [60, 0, 60, 0, 60, 0, 59, 0, 0, 2]
    assert [p["result"] for p in stats["recent"]][:2] == ["bestanden", "nicht_bestanden"]
    groups = {g["subject_group"]: (g["points"], g["max_points"]) for g in stats["group_scores"]}
    # Four full exams, one full except its last (seemannschaft) answer, one with two partial answers up front.
    assert groups["navigation"] == (5 * 18 + 2, 12 * 18)
    assert groups["schifffahrtsrecht"] == (5 * 14, 12 * 14)
    assert groups["wetterkunde"] == (5 * 10, 12 * 10)
    assert groups["seemannschaft"] == (4 * 18 + 17, 12 * 18)


def _progress_by_question(db_session):
    return {row.question_id: row for row in db_session.query(QuestionProgress).all()}


def test_completing_the_exam_credits_only_richtig_answers_to_the_lernstand(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    _answer_and_submit(client, auth_headers, exam)
    outcomes = ["richtig"] * 10 + ["teilweise_richtig"] * 10 + ["falsch"] * 10
    _grade_all(client, auth_headers, exam, outcomes)

    progress = _progress_by_question(db_session)
    assert set(progress) == {q["question_id"] for q in exam["questions"][:10]}
    assert all(row.half_life_days > 1.0 and row.last_correct_at is not None for row in progress.values())


def test_exam_grades_change_nothing_before_the_exam_is_complete(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    _answer_and_submit(client, auth_headers, exam)
    _grade_all(client, auth_headers, {**exam, "questions": exam["questions"][:29]}, ["richtig"] * 29)

    assert db_session.query(QuestionProgress).count() == 0


def test_a_grade_changed_during_the_self_assessment_counts_once_with_its_final_value(
    client, db_session, auth_headers
):
    _seed(db_session)
    exam = _start(client, auth_headers)
    _answer_and_submit(client, auth_headers, exam)
    url = f"/api/v1/exams/{exam['id']}/questions/1/grade"
    client.put(url, json={"outcome": "richtig"}, headers=auth_headers)
    client.put(url, json={"outcome": "richtig"}, headers=auth_headers)
    client.put(url, json={"outcome": "falsch"}, headers=auth_headers)
    _grade_all(client, auth_headers, {**exam, "questions": exam["questions"][1:]}, ["richtig"] * 29)

    progress = _progress_by_question(db_session)
    assert exam["questions"][0]["question_id"] not in progress
    assert len(progress) == 29


def test_exam_richtig_grows_the_half_life_like_a_practice_grading(client, db_session, auth_headers):
    user = _seed(db_session)
    exam = _start(client, auth_headers)
    first = exam["questions"][0]["question_id"]
    db_session.add(
        QuestionProgress(
            user_id=user.id,
            question_id=first,
            half_life_days=2.0,
            last_graded_at=datetime.now(UTC) - timedelta(days=3),
            review_due_at=datetime.now(UTC),
        )
    )
    db_session.commit()
    _answer_and_submit(client, auth_headers, exam)
    _grade_all(client, auth_headers, exam, ["richtig"] * 30)

    # Spacing >= the half-life -> full gain (x2.5).
    assert _progress_by_question(db_session)[first].half_life_days == 5.0


def test_a_question_dropped_from_the_catalog_is_skipped_when_crediting(client, db_session, auth_headers):
    _seed(db_session)
    exam = _start(client, auth_headers)
    _answer_and_submit(client, auth_headers, exam)
    db_session.query(ExamAttemptQuestion).filter_by(attempt_id=exam["id"], position=1).update(
        {"question_id": None}
    )
    db_session.commit()
    _grade_all(client, auth_headers, exam, ["richtig"] * 30)

    assert db_session.query(QuestionProgress).count() == 29
