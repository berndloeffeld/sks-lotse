from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.focus_topic import FocusTopic
from app.models.purchase import Purchase
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.topic import Topic
from app.models.user import User
from tests.helpers import progress_state

_FIXTURE_EMAIL = "fixture-user@example.com"

# A full, valid settings payload — PUT replaces every price/package at once, so tests that don't
# care about a specific value still have to send one.
_SETTINGS_PAYLOAD = {
    "ai_checks_weekly_default": 100,
    "price_ads_removed_cents": 500,
    "signup_bonus_tokens": 6,
    "tokens_s": {"tokens": 20, "price_cents": 299},
    "tokens_m": {"tokens": 50, "price_cents": 599},
    "tokens_l": {"tokens": 100, "price_cents": 999},
    "tokens_xl": {"tokens": 200, "price_cents": 1699},
}


def _fixture_user(db_session) -> User:
    return db_session.query(User).filter_by(email=_FIXTURE_EMAIL).one()


def _make_admin(monkeypatch) -> None:
    monkeypatch.setattr(settings, "admin_emails", _FIXTURE_EMAIL)


def test_admin_routes_require_authentication(client):
    assert client.get("/api/v1/admin/users").status_code == 401
    assert client.get("/api/v1/admin/users/1").status_code == 401
    assert client.get("/api/v1/admin/questions").status_code == 401
    assert client.get("/api/v1/admin/users/1/export").status_code == 401
    assert client.delete("/api/v1/admin/users/1").status_code == 401
    assert client.patch("/api/v1/admin/users/1", json={"ads_removed": True}).status_code == 401


def test_admin_routes_reject_non_admin_user(client, db_session, auth_headers):
    # No admin_emails set at all — the fixture user is logged in but not an admin.
    for path in ("/api/v1/admin/users", "/api/v1/admin/users/1", "/api/v1/admin/questions"):
        assert client.get(path, headers=auth_headers).status_code == 403
    response = client.get("/api/v1/admin/users/1/export", headers=auth_headers)
    assert response.status_code == 403
    response = client.delete("/api/v1/admin/users/1", headers=auth_headers)
    assert response.status_code == 403
    response = client.patch("/api/v1/admin/users/1", json={"ads_removed": True}, headers=auth_headers)
    assert response.status_code == 403


def test_admin_export_includes_denormalized_question_progress(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(2)))
    db_session.commit()

    response = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == _FIXTURE_EMAIL
    assert len(body["question_progress"]) == 1
    row = body["question_progress"][0]
    assert row["subject"] == "navigation"
    assert row["question_number"] == 1
    assert row["half_life_days"] == pytest.approx(6.25)
    assert {"last_graded_at", "last_correct_at", "streak_start_at", "review_due_at"} <= row.keys()


def test_admin_detail_and_export_include_every_profile_field(client, db_session, auth_headers, monkeypatch):
    # Art. 15/20 DSGVO: the export has to contain all personal data stored
    # about the learner — including the optional, self-reported profile fields.
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    user.first_name = "Anna"
    user.last_name = "Beispiel"
    user.gender = "weiblich"
    user.exam_variant = "motor"
    db_session.commit()

    detail = client.get(f"/api/v1/admin/users/{user.id}", headers=auth_headers)
    export = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)

    expected = {"first_name": "Anna", "last_name": "Beispiel", "gender": "weiblich", "exam_variant": "motor"}
    assert detail.json().items() >= expected.items()
    assert export.json()["user"].items() >= expected.items()


def test_admin_detail_and_export_include_the_sanitizer_flag_counter(
    client, db_session, auth_headers, monkeypatch
):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    user.ai_flags_count = 2
    user.ai_flags_last_at = datetime(2026, 9, 20, 12, 0, tzinfo=UTC)
    db_session.commit()

    detail = client.get(f"/api/v1/admin/users/{user.id}", headers=auth_headers)
    export = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)

    assert detail.json()["ai_flags_count"] == 2
    assert export.json()["user"]["ai_flags_count"] == 2


def test_admin_detail_and_export_include_agb_acceptance_and_last_login(
    client, db_session, auth_headers, monkeypatch
):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    user.agb_accepted_version = "2026-09-23"
    user.agb_accepted_at = datetime(2026, 9, 23, 8, 0, tzinfo=UTC)
    user.last_login_at = datetime(2026, 9, 23, 9, 0, tzinfo=UTC)
    db_session.commit()

    detail = client.get(f"/api/v1/admin/users/{user.id}", headers=auth_headers)
    export = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)

    for body in (detail.json(), export.json()["user"]):
        assert body["agb_accepted_version"] == "2026-09-23"
        assert body["last_login_at"] is not None


def test_admin_export_returns_404_for_unknown_user(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.get("/api/v1/admin/users/999999/export", headers=auth_headers)
    assert response.status_code == 404


def test_admin_delete_removes_user_and_cascades_progress(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    user_id = user.id
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1)))
    db_session.commit()

    response = client.delete(f"/api/v1/admin/users/{user_id}", headers=auth_headers)
    assert response.status_code == 204

    db_session.expire_all()
    assert db_session.get(User, user_id) is None
    assert db_session.query(QuestionProgress).filter_by(user_id=user_id).count() == 0


def test_admin_delete_severs_purchases_the_admin_granted_to_others(
    client, db_session, auth_headers, monkeypatch
):
    # The deleted account may itself have been an admin who granted another user's tokens —
    # that reference must not block the delete (see services/user.py).
    _make_admin(monkeypatch)
    admin = _fixture_user(db_session)
    beneficiary = User(email="beneficiary@example.com")
    db_session.add(beneficiary)
    db_session.commit()
    db_session.add(
        Purchase(
            user_id=beneficiary.id,
            product="admin_grant",
            tokens_granted=10,
            amount_eur_cents=None,
            granted_by="admin_manual",
            admin_user_id=admin.id,
        )
    )
    db_session.commit()

    response = client.delete(f"/api/v1/admin/users/{admin.id}", headers=auth_headers)
    assert response.status_code == 204

    db_session.expire_all()
    purchase = db_session.query(Purchase).filter_by(user_id=beneficiary.id).one()
    assert purchase.admin_user_id is None


def test_admin_delete_returns_404_for_unknown_user(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.delete("/api/v1/admin/users/999999", headers=auth_headers)
    assert response.status_code == 404


def test_me_reports_is_admin_true_for_admin(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_admin"] is True


def test_me_reports_is_admin_false_for_non_admin(client, db_session, auth_headers):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_admin"] is False


def test_admin_export_includes_focus_topics(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    topic = Topic(subject="navigation", slug="ankern", name="Ankern", display_order=1)
    db_session.add(topic)
    db_session.commit()
    db_session.add(FocusTopic(user_id=user.id, topic_id=topic.id))
    db_session.commit()

    response = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)
    assert response.status_code == 200
    focus = response.json()["focus_topics"]
    assert [(f["subject"], f["topic_slug"], f["topic_name"]) for f in focus] == [
        ("navigation", "ankern", "Ankern")
    ]


def test_admin_export_includes_purchase_history(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    db_session.add(
        Purchase(
            user_id=user.id,
            product="tokens_m",
            tokens_granted=50,
            amount_eur_cents=599,
            granted_by="admin_manual",
            admin_user_id=user.id,
        )
    )
    db_session.commit()

    response = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers)
    assert response.status_code == 200
    [purchase] = response.json()["purchases"]
    assert (purchase["product"], purchase["tokens_granted"], purchase["amount_eur_cents"]) == (
        "tokens_m",
        50,
        599,
    )
    assert purchase["granted_by"] == "admin_manual"


def test_admin_can_grant_tokens(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    assert user.token_balance == 0

    response = client.patch(
        f"/api/v1/admin/users/{user.id}",
        json={"grant_tokens": 50, "grant_amount_eur_cents": 599},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["token_balance"] == 50
    db_session.refresh(user)
    assert user.token_balance == 50

    purchase = db_session.query(Purchase).filter_by(user_id=user.id, product="admin_grant").one()
    assert (purchase.tokens_granted, purchase.amount_eur_cents, purchase.granted_by) == (
        50,
        599,
        "admin_manual",
    )
    assert purchase.admin_user_id == _fixture_user(db_session).id

    # A second grant adds on top, it doesn't replace the balance.
    response = client.patch(f"/api/v1/admin/users/{user.id}", json={"grant_tokens": 10}, headers=auth_headers)
    assert response.json()["token_balance"] == 60


def test_admin_can_toggle_ads_removed_independently(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    assert user.ads_removed is False

    response = client.patch(
        f"/api/v1/admin/users/{user.id}",
        json={"ads_removed": True, "grant_amount_eur_cents": 500},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["ads_removed"] is True
    assert response.json()["token_balance"] == 0
    db_session.refresh(user)
    assert user.ads_removed is True
    purchase = db_session.query(Purchase).filter_by(user_id=user.id, product="ads_removed").one()
    assert (purchase.tokens_granted, purchase.amount_eur_cents) == (None, 500)

    response = client.patch(f"/api/v1/admin/users/{user.id}", json={"grant_tokens": 20}, headers=auth_headers)
    assert response.json()["ads_removed"] is True
    assert response.json()["token_balance"] == 20

    # Turning ads_removed off again doesn't record a second (refund) purchase row.
    response = client.patch(
        f"/api/v1/admin/users/{user.id}", json={"ads_removed": False}, headers=auth_headers
    )
    assert response.json()["ads_removed"] is False
    assert response.json()["token_balance"] == 20
    assert db_session.query(Purchase).filter_by(user_id=user.id, product="ads_removed").count() == 1


def test_admin_update_rejects_invalid_body_and_unknown_user(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    assert client.patch(f"/api/v1/admin/users/{user.id}", json={}, headers=auth_headers).status_code == 422
    response = client.patch("/api/v1/admin/users/999999", json={"grant_tokens": 5}, headers=auth_headers)
    assert response.status_code == 404


def test_admin_detail_counts_only_that_users_progress(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    me = db_session.query(User).filter_by(email=_FIXTURE_EMAIL).one()
    other = User(email="other@example.com")
    db_session.add(other)
    questions = [Question(subject="navigation", number=n, question_text="Q", answer_text="A") for n in (1, 2)]
    db_session.add_all(questions)
    db_session.commit()
    db_session.add_all(
        [
            QuestionProgress(user_id=me.id, question_id=questions[0].id, **progress_state(1)),
            QuestionProgress(user_id=me.id, question_id=questions[1].id, **progress_state(1)),
            QuestionProgress(user_id=other.id, question_id=questions[0].id, **progress_state(1)),
        ]
    )
    db_session.commit()

    response = client.get(f"/api/v1/admin/users/{me.id}", headers=auth_headers)

    assert response.json()["question_progress_count"] == 2


def test_admin_export_contains_every_stored_exam_and_progress_field(
    client, db_session, auth_headers, monkeypatch
):
    # Art. 15/20 DSGVO: an export that silently drops a stored field is an incomplete disclosure.
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    question = Question(subject="wetterkunde", number=7, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    started = datetime(2026, 3, 1, 10, 0, tzinfo=UTC)
    attempt = ExamAttempt(
        user_id=user.id,
        exam_variant="motor",
        started_at=started,
        deadline_at=started + timedelta(minutes=90),
        submitted_at=started + timedelta(minutes=95),
        graded_at=started + timedelta(minutes=99),
        timed_out=True,
    )
    db_session.add(attempt)
    db_session.flush()
    db_session.add_all(
        [
            ExamAttemptQuestion(
                attempt_id=attempt.id,
                question_id=question.id,
                position=1,
                subject_group="wetterkunde",
                answer_text="Mein Text",
                outcome="teilweise_richtig",
            ),
            # A question that has since left the catalog: kept, but without subject/number.
            ExamAttemptQuestion(attempt_id=attempt.id, position=2, subject_group="navigation"),
        ]
    )
    correct_at = datetime(2026, 3, 2, 9, 0, tzinfo=UTC)
    db_session.add(
        QuestionProgress(
            user_id=user.id, question_id=question.id, last_correct_at=correct_at, **progress_state(2)
        )
    )
    db_session.commit()

    body = client.get(f"/api/v1/admin/users/{user.id}/export", headers=auth_headers).json()

    [exam] = body["exam_attempts"]
    assert exam["exam_id"] == attempt.id
    assert exam["exam_variant"] == "motor"
    assert exam["timed_out"] is True
    assert exam["started_at"].startswith("2026-03-01T10:00")
    assert exam["deadline_at"].startswith("2026-03-01T11:30")
    assert exam["submitted_at"].startswith("2026-03-01T11:35")
    assert exam["graded_at"].startswith("2026-03-01T11:39")
    known, gone = exam["questions"]
    assert (known["subject"], known["question_number"]) == ("wetterkunde", 7)
    assert (known["answer_text"], known["outcome"]) == ("Mein Text", "teilweise_richtig")
    assert (gone["subject"], gone["question_number"], gone["outcome"]) == (None, None, None)
    assert body["question_progress"][0]["last_correct_at"].startswith("2026-03-02T09:00")


def test_settings_routes_require_admin(client, auth_headers):
    assert client.get("/api/v1/admin/settings").status_code == 401
    assert client.put("/api/v1/admin/settings", json=_SETTINGS_PAYLOAD).status_code == 401
    assert client.get("/api/v1/admin/settings", headers=auth_headers).status_code == 403
    response = client.put("/api/v1/admin/settings", json=_SETTINGS_PAYLOAD, headers=auth_headers)
    assert response.status_code == 403


def test_admin_can_read_and_change_the_weekly_default(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    monkeypatch.setattr(settings, "grading_max_per_week", 100)
    assert client.get("/api/v1/admin/settings", headers=auth_headers).json() == _SETTINGS_PAYLOAD

    changed = {**_SETTINGS_PAYLOAD, "ai_checks_weekly_default": 40}
    response = client.put("/api/v1/admin/settings", json=changed, headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == changed
    assert client.get("/api/v1/admin/settings", headers=auth_headers).json() == changed
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["ai_checks_remaining"] == 40


def test_admin_can_change_prices_and_packages(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    changed = {
        **_SETTINGS_PAYLOAD,
        "price_ads_removed_cents": 799,
        "signup_bonus_tokens": 3,
        "tokens_s": {"tokens": 15, "price_cents": 249},
    }
    response = client.put("/api/v1/admin/settings", json=changed, headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == changed
    assert client.get("/api/v1/admin/settings", headers=auth_headers).json() == changed
    assert client.get("/api/v1/pricing").json() == {
        "ads_removed_price_cents": 799,
        "signup_bonus_tokens": 3,
        "packages": [
            {"product": "tokens_s", "tokens": 15, "price_cents": 249},
            {"product": "tokens_m", "tokens": 50, "price_cents": 599},
            {"product": "tokens_l", "tokens": 100, "price_cents": 999},
            {"product": "tokens_xl", "tokens": 200, "price_cents": 1699},
        ],
    }


@pytest.mark.parametrize("value", [-1, 10_001, "x", None])
def test_admin_settings_reject_invalid_default(client, db_session, auth_headers, monkeypatch, value):
    _make_admin(monkeypatch)
    response = client.put(
        "/api/v1/admin/settings",
        json={**_SETTINGS_PAYLOAD, "ai_checks_weekly_default": value},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_admin_can_set_and_reset_a_per_user_weekly_limit(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    monkeypatch.setattr(settings, "grading_max_per_week", 100)
    user_id = _fixture_user(db_session).id
    url = f"/api/v1/admin/users/{user_id}"

    body = client.patch(url, json={"ai_checks_weekly_limit": 7}, headers=auth_headers).json()
    assert (body["ai_checks_weekly_limit"], body["ai_checks_limit"]) == (7, 7)
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["ai_checks_remaining"] == 7

    body = client.patch(url, json={"ai_checks_weekly_limit": None}, headers=auth_headers).json()
    assert (body["ai_checks_weekly_limit"], body["ai_checks_limit"]) == (None, 100)

    assert client.patch(url, json={"ai_checks_weekly_limit": -1}, headers=auth_headers).status_code == 422


def test_ai_flags_count_is_read_only_on_the_admin_patch(client, db_session, auth_headers, monkeypatch):
    # ai_flags_count is a diagnostic signal (ADR-0040), not an entitlement — AdminUserUpdate has no
    # such field, so a PATCH body naming it is silently ignored rather than applied.
    _make_admin(monkeypatch)
    user = _fixture_user(db_session)
    user.ai_flags_count = 3
    db_session.commit()

    response = client.patch(
        f"/api/v1/admin/users/{user.id}",
        json={"ads_removed": True, "ai_flags_count": 0},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["ai_flags_count"] == 3


def test_admin_actions_are_audit_logged_without_personal_data(
    client, db_session, auth_headers, monkeypatch, caplog
):
    _make_admin(monkeypatch)
    admin = _fixture_user(db_session)
    target = User(email="target@example.com")
    db_session.add(target)
    db_session.commit()
    target_id = target.id

    with caplog.at_level("INFO", logger="app.api.v1.admin"):
        client.get("/api/v1/admin/users", params={"q": "target@example"}, headers=auth_headers)
        client.patch(f"/api/v1/admin/users/{target_id}", json={"ads_removed": True}, headers=auth_headers)
        client.put(
            "/api/v1/admin/settings",
            json={**_SETTINGS_PAYLOAD, "ai_checks_weekly_default": 7},
            headers=auth_headers,
        )
        client.get(f"/api/v1/admin/users/{target_id}/export", headers=auth_headers)
        client.delete(f"/api/v1/admin/users/{target_id}", headers=auth_headers)

    messages = [r.getMessage() for r in caplog.records if r.name == "app.api.v1.admin"]
    assert messages == [
        f"admin action: admin={admin.id} action=list_users offset=0 results=1",
        f"admin action: admin={admin.id} action=update_user target_user={target_id} ads_removed=True",
        f"admin action: admin={admin.id} action=update_settings ai_checks_weekly_default=7 "
        "price_ads_removed_cents=500 signup_bonus_tokens=6 tokens_s=(20, 299) tokens_m=(50, 599) "
        "tokens_l=(100, 999) tokens_xl=(200, 1699)",
        f"admin action: admin={admin.id} action=export_user target_user={target_id}",
        f"admin action: admin={admin.id} action=delete_user target_user={target_id}",
    ]
    assert not any("@" in m for m in messages)


def _add_users(db_session, *users: tuple[str, str | None, str | None]) -> list[User]:
    # Created one day apart, oldest first, so the list's newest-first order is deterministic.
    base = datetime(2026, 1, 1, tzinfo=UTC)
    rows = [
        User(email=email, first_name=first, last_name=last, created_at=base + timedelta(days=i))
        for i, (email, first, last) in enumerate(users)
    ]
    db_session.add_all(rows)
    db_session.commit()
    return rows


def _list(client, auth_headers, **params) -> dict:
    response = client.get("/api/v1/admin/users", params=params, headers=auth_headers)
    assert response.status_code == 200
    return response.json()


def test_admin_user_list_is_newest_first(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    _add_users(db_session, ("old@example.com", None, None), ("new@example.com", "Nina", "Neu"))
    body = _list(client, auth_headers)
    assert body["total"] == 3
    emails = [item["email"] for item in body["items"]]
    # The fixture user was created "now", after both.
    assert emails == [_FIXTURE_EMAIL, "new@example.com", "old@example.com"]
    assert body["items"][1] == {
        "id": body["items"][1]["id"],
        "email": "new@example.com",
        "first_name": "Nina",
        "last_name": "Neu",
        "created_at": body["items"][1]["created_at"],
        "token_balance": 0,
        "ads_removed": False,
    }


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("anna", ["anna@example.com"]),  # email
        ("SCHMI", ["anna@example.com"]),  # last name, case-insensitive
        ("  bert ", ["b@example.com"]),  # first name, surrounding blanks stripped
        ("example.com", ["b@example.com", "anna@example.com"]),
        ("nobody", []),
    ],
)
def test_admin_user_list_searches_email_and_names(client, db_session, auth_headers, monkeypatch, q, expected):
    _make_admin(monkeypatch)
    db_session.query(User).filter_by(email=_FIXTURE_EMAIL).update({"email": "admin@admin.test"})
    db_session.commit()
    monkeypatch.setattr(settings, "admin_emails", "admin@admin.test")
    _add_users(db_session, ("anna@example.com", "Anna", "Schmidt"), ("b@example.com", "Bert", None))
    body = _list(client, auth_headers, q=q)
    assert [item["email"] for item in body["items"]] == expected
    assert body["total"] == len(expected)


def test_admin_user_list_takes_wildcards_literally(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    _add_users(db_session, ("a_b@example.com", None, None), ("axb@example.com", None, "100%"))
    assert [i["email"] for i in _list(client, auth_headers, q="a_b")["items"]] == ["a_b@example.com"]
    assert [i["email"] for i in _list(client, auth_headers, q="%")["items"]] == ["axb@example.com"]


def test_admin_user_list_pages(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    _add_users(db_session, *((f"u{n}@example.com", None, None) for n in range(3)))
    body = _list(client, auth_headers, q="@example.com", offset=1, limit=1)
    assert body["total"] == 4
    assert [item["email"] for item in body["items"]] == ["u2@example.com"]
    assert _list(client, auth_headers, q="@example.com", offset=4)["items"] == []


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 201}, {"offset": -1}, {"q": "x" * 255}])
def test_admin_user_list_rejects_bad_parameters(client, db_session, auth_headers, monkeypatch, params):
    _make_admin(monkeypatch)
    response = client.get("/api/v1/admin/users", params=params, headers=auth_headers)
    assert response.status_code == 422


def test_admin_user_detail(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    (user,) = _add_users(db_session, ("detail@example.com", "Dora", None))
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.flush()
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1)))
    db_session.commit()

    response = client.get(f"/api/v1/admin/users/{user.id}", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert (body["email"], body["first_name"]) == ("detail@example.com", "Dora")
    assert body["question_progress_count"] == 1
    assert client.get("/api/v1/admin/users/999999", headers=auth_headers).status_code == 404


def _add_questions(db_session) -> list[Question]:
    texts = [
        ("navigation", 1, "Was ist ein Kompass?", "Ein Gerät."),
        ("navigation", 12, "Was ist Ebbe?", "Fallendes Wasser."),
        ("seemannschaft", 3, "Wie ankert man?", "Mit dem ANKER."),
    ]
    rows = [Question(subject=s, number=n, question_text=q, answer_text=a) for s, n, q, a in texts]
    db_session.add_all(rows)
    db_session.commit()
    return rows


def _search(client, auth_headers, **params) -> list[tuple[str, int]]:
    response = client.get("/api/v1/admin/questions", params=params, headers=auth_headers)
    assert response.status_code == 200
    return [(q["subject"], q["number"]) for q in response.json()]


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({}, [("navigation", 1), ("navigation", 12), ("seemannschaft", 3)]),
        ({"subject": "navigation"}, [("navigation", 1), ("navigation", 12)]),
        ({"q": "KOMPASS"}, [("navigation", 1)]),  # question text, case-insensitive
        ({"q": "anker"}, [("seemannschaft", 3)]),  # question and answer text
        ({"q": "wasser"}, [("navigation", 12)]),  # answer text only
        ({"q": "12"}, [("navigation", 12)]),  # catalog number
        ({"q": "3", "subject": "navigation"}, []),
        ({"q": "gibt es nicht"}, []),
    ],
)
def test_admin_question_search(client, db_session, auth_headers, monkeypatch, params, expected):
    _make_admin(monkeypatch)
    _add_questions(db_session)
    assert _search(client, auth_headers, **params) == expected


def test_admin_question_search_finds_by_id(client, db_session, auth_headers, monkeypatch):
    _make_admin(monkeypatch)
    rows = _add_questions(db_session)
    body = client.get("/api/v1/admin/questions", params={"q": str(rows[2].id)}, headers=auth_headers).json()
    assert rows[2].id in [q["id"] for q in body]
    assert body[-1]["answer_text"] == "Mit dem ANKER."
