from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.core.config import settings
from app.core.features import chart_exercises_enabled_for
from app.models.chart_attempt import ChartAttempt, ChartAttemptTask
from app.models.user import User
from app.services import chart_exercises as service
from app.services.user import delete_user_and_progress
from tests.helpers import FIXTURE_EMAIL, fixture_user, make_admin

CHARTS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "charts"
BASE = "/api/v1/chart-exercises"


@pytest.fixture(autouse=True)
def _feature_on(monkeypatch):
    monkeypatch.setattr(settings, "chart_exercises", "on")


def _start(client, auth_headers, number=1):
    response = client.post(f"{BASE}/{number}/attempts", headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


def _answer(client, auth_headers, attempt_id, task, text="Meine Antwort"):
    return client.put(
        f"{BASE}/attempts/{attempt_id}/tasks/{task}/answer", json={"answer_text": text}, headers=auth_headers
    )


def _points(client, auth_headers, attempt_id, task, points):
    return client.put(
        f"{BASE}/attempts/{attempt_id}/tasks/{task}/points", json={"points": points}, headers=auth_headers
    )


def _complete(client, auth_headers, attempt, award=lambda max_points: max_points):
    body = attempt
    for task in service.exercise(attempt["exercise_number"]).tasks:
        assert _answer(client, auth_headers, attempt["id"], task.number).status_code == 200
        response = _points(client, auth_headers, attempt["id"], task.number, award(task.points))
        assert response.status_code == 200, response.text
        body = response.json()
    return body


# --- the committed content ---------------------------------------------------------------------


def test_the_catalog_has_consecutive_sheets_of_thirty_points():
    # Sheets are added as their solutions are transcribed (ADR-0053); always numbered from 1 without gaps.
    sheets = service.catalog().sheets
    assert sheets
    assert [sheet.number for sheet in sheets] == list(range(1, len(sheets) + 1))
    for sheet in sheets:
        assert service.max_points(sheet) == 30
        assert [task.number for task in sheet.tasks] == list(range(1, len(sheet.tasks) + 1))


def test_every_task_has_questions_matching_its_points_and_a_solution():
    for sheet in service.catalog().sheets:
        for task in sheet.tasks:
            assert task.questions, (sheet.number, task.number)
            assert sum(q.points for q in task.questions) == task.points, (sheet.number, task.number)
            assert task.solution, (sheet.number, task.number)
            for part in task.solution:
                assert part.results or part.image, (sheet.number, task.number)


def test_every_referenced_image_exists():
    data = service.catalog()
    images = [data.tide_form] + [
        part.image for sheet in data.sheets for task in sheet.tasks for part in task.solution if part.image
    ]
    missing = [image.src for image in images if not (CHARTS_DIR / image.src).is_file()]
    assert missing == []


def test_the_task_text_carries_no_extraction_debris():
    # Bullets belong to the points, private-use glyphs to the PDF's symbol font.
    for sheet in service.catalog().sheets:
        for task in sheet.tasks:
            for text in [task.text, *(q.text for q in task.questions)]:
                assert "•" not in text
                assert not any("" <= ch <= "" for ch in text)
                assert "­" not in text


def test_exercise_returns_none_for_an_unknown_number():
    assert service.exercise(11) is None


# --- the feature flag --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("flag", "admin", "expected"),
    [("off", True, False), ("admins", False, False), ("admins", True, True), ("on", False, True)],
)
def test_flag_decides_who_sees_the_feature(monkeypatch, flag, admin, expected):
    monkeypatch.setattr(settings, "chart_exercises", flag)
    monkeypatch.setattr(settings, "admin_emails", "Fixture-User@Example.com" if admin else "")
    assert chart_exercises_enabled_for(FIXTURE_EMAIL) is expected


def test_routes_answer_404_when_the_flag_is_off(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "chart_exercises", "off")
    assert client.get(BASE, headers=auth_headers).status_code == 404
    assert client.post(f"{BASE}/1/attempts", headers=auth_headers).status_code == 404


def test_admins_mode_opens_the_routes_to_admins_only(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "chart_exercises", "admins")
    assert client.get(BASE, headers=auth_headers).status_code == 404
    make_admin(monkeypatch)
    assert client.get(BASE, headers=auth_headers).status_code == 200


def test_me_reports_the_flag(client, auth_headers, monkeypatch):
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["can_use_chart_exercises"] is True
    monkeypatch.setattr(settings, "chart_exercises", "off")
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["can_use_chart_exercises"] is False


# --- overview and runs -------------------------------------------------------------------------


def test_overview_lists_the_exercises_with_the_shared_material(client, auth_headers):
    body = client.get(BASE, headers=auth_headers).json()
    assert [e["number"] for e in body["exercises"]] == [sheet.number for sheet in service.catalog().sheets]
    assert body["exercises"][0] == {
        "number": 1,
        "task_count": 18,
        "max_points": 30,
        "open_attempt_id": None,
        "completed_count": 0,
        "last_points": None,
    }
    assert body["tide_form"]["src"] == "formblatt-gezeiten.png"
    assert body["hints"][0].startswith("Erlaubte Hilfsmittel")
    assert "WSV" in body["source"]


def test_start_shows_only_the_first_task_without_its_solution(client, auth_headers):
    attempt = _start(client, auth_headers)
    assert attempt["current_task"] == 1
    assert attempt["points"] == 0
    assert attempt["max_points"] == 30
    assert attempt["completed_at"] is None
    assert [t["number"] for t in attempt["tasks"]] == [1]
    first = attempt["tasks"][0]
    assert first["answer_text"] is None
    assert first["solution"] == []
    assert first["derivation"] == []
    assert first["questions"][0]["text"].startswith("Bestimmen Sie die Hochwasserzeit")


def test_start_refuses_an_unknown_exercise(client, auth_headers):
    assert client.post(f"{BASE}/11/attempts", headers=auth_headers).status_code == 404


def test_start_refuses_a_second_open_run_of_the_same_exercise(client, auth_headers):
    _start(client, auth_headers)
    assert client.post(f"{BASE}/1/attempts", headers=auth_headers).status_code == 409
    _start(client, auth_headers, number=2)  # another exercise is fine


def test_parallel_start_is_rejected_by_the_database(client, db_session, auth_headers, monkeypatch):
    # Two parallel starts: the application-level check sees no open run (as it would for the
    # second request), so only the partial unique index stops it.
    _start(client, auth_headers)
    monkeypatch.setattr(service, "has_open_attempt", lambda db, user, number: False)
    assert client.post(f"{BASE}/1/attempts", headers=auth_headers).status_code == 409
    assert db_session.query(ChartAttempt).count() == 1


def test_answer_reveals_the_solution_of_that_task(client, auth_headers):
    attempt = _start(client, auth_headers)
    response = _answer(client, auth_headers, attempt["id"], 1, "HWZ 08:53")
    assert response.status_code == 200
    task = response.json()["tasks"][0]
    assert task["answer_text"] == "HWZ 08:53"
    # The results with their tolerance, and the tide table that leads to them as the derivation.
    assert task["solution"][0]["results"][0] == {"text": "HWZ = 08:53 MESZ/BZ", "tolerance": "Keine Toleranz"}
    assert task["derivation"][1]["table"][2] == {
        "cells": ["FD/TF Cuxhaven", "**06 h 38 min**", "**2,5 m**"],
        "sum": True,
        "sum_until": None,
    }
    assert response.json()["current_task"] == 1  # still to be assessed


def test_an_empty_answer_is_allowed(client, auth_headers):
    attempt = _start(client, auth_headers)
    assert _answer(client, auth_headers, attempt["id"], 1, "").status_code == 200


def test_answer_refuses_a_task_out_of_order_twice_or_unknown(client, auth_headers):
    attempt = _start(client, auth_headers)
    assert _answer(client, auth_headers, attempt["id"], 2).status_code == 409
    assert _answer(client, auth_headers, attempt["id"], 99).status_code == 404
    assert _answer(client, auth_headers, attempt["id"], 1).status_code == 200
    second = _answer(client, auth_headers, attempt["id"], 1)
    assert second.status_code == 409
    assert second.json()["detail"] == "The task is already answered"


def test_answer_length_is_bounded(client, auth_headers):
    attempt = _start(client, auth_headers)
    assert _answer(client, auth_headers, attempt["id"], 1, "x" * 5001).status_code == 422


def test_points_need_an_answer_and_stay_within_the_tasks_maximum(client, auth_headers):
    attempt = _start(client, auth_headers)
    unanswered = _points(client, auth_headers, attempt["id"], 1, 1)
    assert unanswered.status_code == 409
    assert unanswered.json()["detail"] == "Answer the task first"
    _answer(client, auth_headers, attempt["id"], 1)
    too_many = _points(client, auth_headers, attempt["id"], 1, 3)
    assert too_many.status_code == 409
    assert too_many.json()["detail"] == "At most 2 points"
    assert _points(client, auth_headers, attempt["id"], 1, -1).status_code == 422
    assert _points(client, auth_headers, attempt["id"], 2, 0).status_code == 409


def test_points_advance_to_the_next_task(client, auth_headers):
    attempt = _start(client, auth_headers)
    _answer(client, auth_headers, attempt["id"], 1)
    body = _points(client, auth_headers, attempt["id"], 1, 2).json()
    assert body["current_task"] == 2
    assert body["points"] == 2
    assert [t["number"] for t in body["tasks"]] == [1, 2]
    assert body["tasks"][0]["points_awarded"] == 2
    assert body["tasks"][1]["solution"] == []
    # An assessed task is closed.
    assert _points(client, auth_headers, attempt["id"], 1, 1).status_code == 409


def test_the_last_points_complete_the_run(client, auth_headers):
    attempt = _start(client, auth_headers)
    body = _complete(client, auth_headers, attempt, award=lambda max_points: max_points - 1)
    assert body["current_task"] is None
    assert body["completed_at"] is not None
    assert len(body["tasks"]) == 18
    assert body["points"] == 30 - 18
    assert all(task["solution"] for task in body["tasks"])


def test_overview_reflects_open_and_completed_runs(client, auth_headers):
    attempt = _start(client, auth_headers)
    assert client.get(BASE, headers=auth_headers).json()["exercises"][0]["open_attempt_id"] == attempt["id"]
    _complete(client, auth_headers, attempt)
    summary = client.get(BASE, headers=auth_headers).json()["exercises"][0]
    assert summary["open_attempt_id"] is None
    assert summary["completed_count"] == 1
    assert summary["last_points"] == 30
    _start(client, auth_headers)  # a completed exercise can be run again


def test_last_points_come_from_the_latest_completed_run(db_session):
    user = User(email="someone@example.com")
    db_session.add(user)
    db_session.flush()
    earlier, later = datetime(2026, 9, 1, tzinfo=UTC), datetime(2026, 9, 2, tzinfo=UTC)

    def run(started, completed, points):
        attempt = ChartAttempt(user_id=user.id, exercise_number=2, started_at=started, completed_at=completed)
        attempt.tasks.append(
            ChartAttemptTask(task_number=1, answer_text="", answered_at=started, points_awarded=points)
        )
        db_session.add(attempt)

    # Started first but finished last: its points are the latest.
    run(earlier, later + timedelta(days=1), 7)
    run(later, later, 3)
    db_session.commit()
    assert service.overview(db_session, user).exercises[1].last_points == 7


def test_get_returns_the_run_and_hides_other_learners_runs(client, db_session, auth_headers):
    attempt = _start(client, auth_headers)
    assert client.get(f"{BASE}/attempts/{attempt['id']}", headers=auth_headers).json() == attempt
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.flush()
    foreign = ChartAttempt(user_id=other.id, exercise_number=1, started_at=datetime.now(UTC))
    db_session.add(foreign)
    db_session.commit()
    assert client.get(f"{BASE}/attempts/{foreign.id}", headers=auth_headers).status_code == 404
    assert _answer(client, auth_headers, foreign.id, 1).status_code == 404


def test_delete_removes_the_run(client, db_session, auth_headers):
    attempt = _start(client, auth_headers)
    _answer(client, auth_headers, attempt["id"], 1)
    assert client.delete(f"{BASE}/attempts/{attempt['id']}", headers=auth_headers).status_code == 204
    assert db_session.query(ChartAttempt).count() == 0
    assert db_session.query(ChartAttemptTask).count() == 0
    assert client.get(f"{BASE}/attempts/{attempt['id']}", headers=auth_headers).status_code == 404


# --- personal data -----------------------------------------------------------------------------


def test_account_deletion_removes_chart_runs(client, db_session, auth_headers):
    attempt = _start(client, auth_headers)
    _answer(client, auth_headers, attempt["id"], 1)
    delete_user_and_progress(db_session, fixture_user(db_session))
    assert db_session.query(ChartAttempt).count() == 0
    assert db_session.query(ChartAttemptTask).count() == 0


def test_admin_export_includes_chart_runs(client, db_session, auth_headers, monkeypatch):
    attempt = _start(client, auth_headers)
    _answer(client, auth_headers, attempt["id"], 1, "HWZ 08:53")
    _points(client, auth_headers, attempt["id"], 1, 2)
    make_admin(monkeypatch)
    user_id = fixture_user(db_session).id
    export = client.get(f"/api/v1/admin/users/{user_id}/export", headers=auth_headers).json()
    [run] = export["chart_attempts"]
    assert run["attempt_id"] == attempt["id"]
    assert run["exercise_number"] == 1
    assert run["completed_at"] is None
    assert run["tasks"] == [
        {
            "task_number": 1,
            "answer_text": "HWZ 08:53",
            "answered_at": run["tasks"][0]["answered_at"],
            "points_awarded": 2,
        }
    ]
