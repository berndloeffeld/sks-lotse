"""Saved runs of SBF Lotse's Navigationsaufgaben and their Lotsen-Check (ADR-0071)."""

import pytest

from app.api.v1 import sbf_navigation as sbf_api
from app.models.lotse_check_log import LotseCheckLog
from app.models.sbf_navigation_attempt import SbfNavigationAttempt
from app.models.user import User
from app.services import sbf_navigation, token_wallet
from app.services.grader import GradingUnavailable
from app.services.sbf_navigation_grader import GradedSbfAnswer, SbfGradeResult
from app.services.user import delete_user_and_progress
from tests.helpers import fixture_user, make_admin

BASE = "/api/v1/sbf-navigation"
SBF = {"Origin": "http://localhost:5174"}


@pytest.fixture()
def sbf(auth_headers):
    """The fixture user's headers, sent from SBF Lotse's (dev) origin."""
    return {**auth_headers, **SBF}


def _refused(response, status: int, detail: str) -> None:
    assert (response.status_code, response.json()) == (status, {"detail": detail})


def _start(client, headers, number=1):
    response = client.post(f"{BASE}/{number}/attempts", headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _answer(client, headers, attempt_id, number, text="rwK = 079°"):
    return client.put(
        f"{BASE}/attempts/{attempt_id}/subtasks/{number}/answer", json={"answer_text": text}, headers=headers
    )


def _point(client, headers, attempt_id, number, point):
    return client.put(
        f"{BASE}/attempts/{attempt_id}/subtasks/{number}/point", json={"point": point}, headers=headers
    )


def _ai_check(client, headers, attempt_id, number):
    return client.post(f"{BASE}/attempts/{attempt_id}/subtasks/{number}/ai-check", headers=headers)


def _give_tokens(db_session, tokens=10):
    user = fixture_user(db_session)
    user.token_balance = tokens
    db_session.commit()
    return user


def _complete(client, headers, attempt_id, points=1):
    for number in range(1, 10):
        _answer(client, headers, attempt_id, number)
        response = _point(client, headers, attempt_id, number, points)
    return response.json()


@pytest.fixture()
def fake_grader(monkeypatch):
    calls = []

    def fake(data, task, earlier, subtask, learner_answer):
        calls.append((task.number, [e.subtask.number for e in earlier], subtask.number, learner_answer))
        return GradedSbfAnswer(
            SbfGradeResult(feedback="Innerhalb der Toleranz.", suspected_error="", correct=True),
            sanitized=False,
        )

    monkeypatch.setattr(sbf_api, "grade_sbf_answer", fake)
    return calls


# --- the site ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "headers", [{}, {"Origin": "http://localhost:5173"}, {"Origin": "https://evil.example"}]
)
def test_the_runs_belong_to_sbf_lotse(client, auth_headers, headers):
    _refused(client.get(BASE, headers={**auth_headers, **headers}), 403, "Only on SBF Lotse")


def test_the_sbf_api_host_counts_as_sbf_lotse(client, auth_headers):
    response = client.get(BASE, headers={**auth_headers, "Host": "api.sbf-lotse.de"})
    assert response.status_code == 200


def test_without_a_session_it_is_401(client):
    assert client.get(BASE, headers=SBF).status_code == 401


# --- a run -------------------------------------------------------------------------------------


def test_overview_lists_every_task_and_the_pass_mark(client, sbf):
    body = client.get(BASE, headers=sbf).json()
    assert body["pass_points"] == 7
    assert [task["number"] for task in body["tasks"]] == list(range(1, 16))
    assert body["tasks"][0] == {
        "number": 1,
        "open_attempt_id": None,
        "open_answered": None,
        "completed_count": 0,
        "last_points": None,
        "last_completed_at": None,
    }


def test_start_answer_and_point_go_strictly_in_order(client, sbf):
    attempt = _start(client, sbf)
    assert (attempt["task_number"], attempt["subtask_count"], attempt["current_subtask"]) == (1, 9, 1)
    assert attempt["subtasks"] == []

    _refused(_answer(client, sbf, attempt["id"], 2), 409, "Only the current subtask can be worked on")
    _refused(_point(client, sbf, attempt["id"], 1, 1), 409, "Answer the subtask first")
    body = _answer(client, sbf, attempt["id"], 1).json()
    assert body["subtasks"] == [
        {"number": 1, "answer_text": "rwK = 079°", "point": None, "ai_checkable": True, "ai_suggestion": None}
    ]
    _refused(_answer(client, sbf, attempt["id"], 1), 409, "The subtask is already answered")

    body = _point(client, sbf, attempt["id"], 1, 1).json()
    assert (body["points"], body["current_subtask"]) == (1, 2)


def test_a_point_is_zero_or_one(client, sbf):
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1)
    assert _point(client, sbf, attempt["id"], 1, 2).status_code == 422


def test_an_unknown_subtask_or_task_is_404(client, sbf):
    attempt = _start(client, sbf)
    _refused(_answer(client, sbf, attempt["id"], 10), 404, "Subtask not found")
    _refused(client.post(f"{BASE}/16/attempts", headers=sbf), 404, "Navigation task not found")


def test_the_last_point_completes_the_run_and_the_overview_says_so(client, sbf):
    attempt = _start(client, sbf)
    body = _complete(client, sbf, attempt["id"])
    assert (body["points"], body["current_subtask"]) == (9, None)
    assert body["completed_at"] is not None

    summary = client.get(BASE, headers=sbf).json()["tasks"][0]
    assert (summary["completed_count"], summary["last_points"], summary["open_attempt_id"]) == (1, 9, None)


def test_one_open_run_per_task(client, sbf):
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1)
    _refused(
        client.post(f"{BASE}/1/attempts", headers=sbf), 409, "This navigation task is already in progress"
    )
    summary = client.get(BASE, headers=sbf).json()["tasks"][0]
    assert (summary["open_attempt_id"], summary["open_answered"]) == (attempt["id"], 1)
    _start(client, sbf, number=2)


def test_parallel_start_is_rejected_by_the_database(client, sbf, monkeypatch):
    _start(client, sbf)
    monkeypatch.setattr(sbf_api.service, "has_open_attempt", lambda db, user, number: False)
    _refused(
        client.post(f"{BASE}/1/attempts", headers=sbf), 409, "This navigation task is already in progress"
    )


def test_another_learners_run_is_not_found(client, db_session, sbf):
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.flush()
    attempt = SbfNavigationAttempt(user_id=other.id, task_number=1, started_at=sbf_api.service.now())
    db_session.add(attempt)
    db_session.commit()
    _refused(client.get(f"{BASE}/attempts/{attempt.id}", headers=sbf), 404, "Navigation attempt not found")


def test_delete_removes_the_run(client, db_session, sbf):
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1)
    assert client.delete(f"{BASE}/attempts/{attempt['id']}", headers=sbf).status_code == 204
    assert db_session.query(SbfNavigationAttempt).count() == 0


def test_account_deletion_removes_the_runs(client, db_session, sbf):
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1)
    delete_user_and_progress(db_session, fixture_user(db_session))
    assert db_session.query(SbfNavigationAttempt).count() == 0


def test_the_admin_export_includes_the_runs(client, db_session, auth_headers, sbf, monkeypatch, fake_grader):
    attempt = _start(client, sbf)
    _give_tokens(db_session)
    _answer(client, sbf, attempt["id"], 1)
    _ai_check(client, sbf, attempt["id"], 1)
    make_admin(monkeypatch)
    user_id = fixture_user(db_session).id
    export = client.get(f"/api/v1/admin/users/{user_id}/export", headers=auth_headers).json()
    [run] = export["sbf_navigation_attempts"]
    assert run["task_number"] == 1
    assert run["subtasks"][0]["answer_text"] == "rwK = 079°"
    assert run["subtasks"][0]["ai_correct"] is True


# --- the Lotsen-Check ----------------------------------------------------------------------------


def test_ai_check_stores_the_suggestion_and_spends_two_tokens(client, db_session, sbf, fake_grader):
    _give_tokens(db_session)
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1, "rwK 078°")
    _point(client, sbf, attempt["id"], 1, 1)
    _answer(client, sbf, attempt["id"], 2, "MgK 073°")

    response = _ai_check(client, sbf, attempt["id"], 2)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["tokens_remaining"] == 10 - token_wallet.TOKENS_PER_SBF_NAVIGATION_CHECK
    assert body["attempt"]["subtasks"][1]["ai_suggestion"] == {
        "correct": True,
        "feedback": "Innerhalb der Toleranz.",
        "suspected_error": "",
    }
    # The run so far goes along, for follow-on errors.
    assert fake_grader == [(1, [1], 2, "MgK 073°")]
    assert db_session.query(LotseCheckLog).one().kind == "sbf_navigation"
    # The point stays the learner's to give.
    assert body["attempt"]["subtasks"][1]["point"] is None


def test_ai_check_is_once_per_subtask(client, db_session, sbf, fake_grader):
    _give_tokens(db_session)
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1)
    assert _ai_check(client, sbf, attempt["id"], 1).status_code == 200
    _refused(_ai_check(client, sbf, attempt["id"], 1), 409, "The subtask is already checked")


def test_ai_check_refuses_what_it_cannot_or_may_not_look_at(client, db_session, sbf, fake_grader):
    _give_tokens(db_session)
    attempt = _start(client, sbf)
    _refused(_ai_check(client, sbf, attempt["id"], 1), 409, "Answer the subtask first")
    _answer(client, sbf, attempt["id"], 1, "   ")
    _refused(_ai_check(client, sbf, attempt["id"], 1), 409, "There is no answer to check")
    _refused(_ai_check(client, sbf, attempt["id"], 2), 409, "Only the current subtask can be worked on")
    assert fake_grader == []


def test_ai_check_is_off_for_a_chart_entry(client, db_session, sbf, fake_grader):
    _give_tokens(db_session)
    attempt = _start(client, sbf)
    for number in range(1, 7):
        _answer(client, sbf, attempt["id"], number)
        _point(client, sbf, attempt["id"], number, 1)
    body = _answer(client, sbf, attempt["id"], 7, "eingetragen").json()
    assert body["subtasks"][6]["ai_checkable"] is False
    _refused(
        _ai_check(client, sbf, attempt["id"], 7),
        409,
        "The result is an entry in the chart; the Lotsen-Check can't see it",
    )


def test_ai_check_needs_two_tokens(client, db_session, sbf, fake_grader):
    _give_tokens(db_session, tokens=1)
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1)
    _refused(_ai_check(client, sbf, attempt["id"], 1), 402, "Not enough tokens for an answer check")


def test_ai_check_refuses_an_answer_too_long_for_it(client, db_session, sbf, fake_grader, monkeypatch):
    monkeypatch.setattr(sbf_api.settings, "grading_max_answer_chars", 5)
    _give_tokens(db_session)
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1, "rwK = 079°")
    _refused(_ai_check(client, sbf, attempt["id"], 1), 422, "The answer is too long for the Lotsen-Check")


def test_a_failed_check_costs_nothing(client, db_session, sbf, monkeypatch):
    def unavailable(*args):
        raise GradingUnavailable("down")

    monkeypatch.setattr(sbf_api, "grade_sbf_answer", unavailable)
    _give_tokens(db_session)
    attempt = _start(client, sbf)
    _answer(client, sbf, attempt["id"], 1)
    assert _ai_check(client, sbf, attempt["id"], 1).status_code == 503
    assert fixture_user(db_session).token_balance == 10


def test_the_task_data_is_the_export_the_page_reads():
    # The run stores numbers only; the page shows the task from the export of the same YAML.
    assert sbf_navigation.max_points(sbf_navigation.task(1)) == 9
