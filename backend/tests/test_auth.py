from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.core.jwt import create_access_token
from app.core.otp import OTP_PURPOSE_LOGIN
from app.models import OtpCode, Question, QuestionProgress, User
from tests.helpers import progress_state


def _capture_otp(monkeypatch):
    sent = []

    def fake_send(to_email, code):
        sent.append((to_email, code))

    monkeypatch.setattr("app.services.email.send_otp_email", fake_send)
    return sent


def _request_and_get_code(client, db_session, monkeypatch, email="learner@example.com"):
    sent = _capture_otp(monkeypatch)
    response = client.post("/api/v1/auth/otp/request", json={"email": email})
    assert response.status_code == 202
    assert len(sent) == 1
    return sent[0][1]


def test_request_otp_returns_202_and_calls_email_service(client, monkeypatch):
    sent = _capture_otp(monkeypatch)

    response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert response.status_code == 202
    assert len(sent) == 1
    assert sent[0][0] == "learner@example.com"


def test_request_otp_skips_non_whitelisted_email(client, monkeypatch):
    sent = _capture_otp(monkeypatch)
    monkeypatch.setattr(settings, "allowed_emails", "vip@example.com")

    response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert response.status_code == 202
    assert len(sent) == 0


def test_request_otp_allows_whitelisted_email_case_insensitively(client, monkeypatch):
    sent = _capture_otp(monkeypatch)
    monkeypatch.setattr(settings, "allowed_emails", "Learner@Example.com, vip@example.com")

    response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert response.status_code == 202
    assert len(sent) == 1


def test_request_otp_gmail_variants_share_one_cooldown_and_get_the_canonical_address(client, monkeypatch):
    # a.b+x@googlemail.com and ab@gmail.com are one inbox: the dot/plus/domain
    # spelling must not mint a fresh per-address quota.
    sent = _capture_otp(monkeypatch)

    for variant in ("Anna.Meyer+sks@googlemail.com", "annameyer@gmail.com", "a.nnameyer@gmail.com"):
        assert client.post("/api/v1/auth/otp/request", json={"email": variant}).status_code == 202

    assert [to for to, _ in sent] == ["annameyer@gmail.com"]


def test_gmail_variants_log_into_the_same_account(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch, email="annameyer@gmail.com")
    assert client.post(
        "/api/v1/auth/otp/verify", json={"email": "annameyer@gmail.com", "code": code}
    ).is_success

    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 0)
    code = _request_and_get_code(client, db_session, monkeypatch, email="Anna.Meyer+x@googlemail.com")
    assert client.post(
        "/api/v1/auth/otp/verify", json={"email": "Anna.Meyer+x@googlemail.com", "code": code}
    ).is_success

    assert db_session.query(User).count() == 1


def test_request_otp_allowlist_matches_gmail_variants(client, monkeypatch):
    sent = _capture_otp(monkeypatch)
    monkeypatch.setattr(settings, "allowed_emails", "anna.meyer@googlemail.com")

    client.post("/api/v1/auth/otp/request", json={"email": "annameyer+trick@gmail.com"})

    assert len(sent) == 1


def test_request_otp_email_case_variants_share_one_cooldown(client, monkeypatch):
    # Upper-casing the local part must not mint a fresh per-email quota.
    sent = _capture_otp(monkeypatch)

    client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})
    client.post("/api/v1/auth/otp/request", json={"email": "Learner@Example.com"})
    client.post("/api/v1/auth/otp/request", json={"email": "LEARNER@example.com"})

    assert len(sent) == 1
    assert sent[0][0] == "learner@example.com"


def test_request_otp_email_send_failure_still_returns_202(client, monkeypatch, caplog):
    def failing_send(to_email, code):
        raise RuntimeError("resend down")

    monkeypatch.setattr("app.services.email.send_otp_email", failing_send)

    response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert response.status_code == 202
    assert "l***@example.com" in caplog.text
    assert "learner@example.com" not in caplog.text


def test_request_otp_skips_disposable_domain(client, monkeypatch):
    sent = _capture_otp(monkeypatch)

    response = client.post("/api/v1/auth/otp/request", json={"email": "someone@mailinator.com"})

    assert response.status_code == 202
    assert len(sent) == 0


def test_request_otp_within_cooldown_skips_second_send(client, monkeypatch):
    sent = _capture_otp(monkeypatch)

    first = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})
    second = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert first.status_code == 202
    assert second.status_code == 202
    assert len(sent) == 1


def test_request_otp_throttled_after_max_requests_per_window(client, db_session, monkeypatch):
    sent = _capture_otp(monkeypatch)
    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 0)

    for _ in range(5):
        response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})
        assert response.status_code == 202
    assert len(sent) == 5

    response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert response.status_code == 202
    assert len(sent) == 5


def test_request_otp_ip_rate_limited_across_different_emails(client, monkeypatch):
    _capture_otp(monkeypatch)

    for i in range(20):
        response = client.post("/api/v1/auth/otp/request", json={"email": f"flood{i}@example.com"})
        assert response.status_code == 202

    response = client.post("/api/v1/auth/otp/request", json={"email": "flood20@example.com"})

    assert response.status_code == 429


def test_request_otp_cleans_up_codes_past_retention(client, db_session, monkeypatch):
    _capture_otp(monkeypatch)
    now = datetime.now(UTC)

    stale = OtpCode(
        email="old@example.com",
        purpose=OTP_PURPOSE_LOGIN,
        code_hash="irrelevant",
        expires_at=now - timedelta(hours=settings.otp_code_retention_hours, minutes=1),
    )
    recent = OtpCode(
        email="old@example.com",
        purpose=OTP_PURPOSE_LOGIN,
        code_hash="irrelevant",
        expires_at=now - timedelta(minutes=1),
    )
    db_session.add_all([stale, recent])
    db_session.commit()
    stale_id, recent_id = stale.id, recent.id

    response = client.post("/api/v1/auth/otp/request", json={"email": "someone-else@example.com"})

    assert response.status_code == 202
    remaining_ids = {row.id for row in db_session.query(OtpCode).all()}
    assert stale_id not in remaining_ids
    assert recent_id in remaining_ids


def test_request_otp_cleanup_is_throttled_across_requests(client, db_session, monkeypatch):
    _capture_otp(monkeypatch)
    now = datetime.now(UTC)

    # First request runs cleanup (nothing to sweep yet) and starts the
    # throttle window.
    client.post("/api/v1/auth/otp/request", json={"email": "first@example.com"})

    stale = OtpCode(
        email="old@example.com",
        purpose=OTP_PURPOSE_LOGIN,
        code_hash="irrelevant",
        expires_at=now - timedelta(hours=settings.otp_code_retention_hours, minutes=1),
    )
    db_session.add(stale)
    db_session.commit()
    stale_id = stale.id

    # A different email, so nothing about this second request is blocked by
    # the per-email cooldown/window checks — it's cleanup's own throttle
    # that should skip the sweep here, within settings.otp_cleanup_min_interval_seconds
    # of the first request.
    response = client.post("/api/v1/auth/otp/request", json={"email": "second@example.com"})

    assert response.status_code == 202
    remaining_ids = {row.id for row in db_session.query(OtpCode).all()}
    assert stale_id in remaining_ids


def test_dev_peek_returns_the_code_from_the_matching_request(client, monkeypatch):
    _capture_otp(monkeypatch)
    client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    response = client.get("/api/v1/auth/otp/_dev-peek", params={"email": "learner@example.com"})

    assert response.status_code == 200
    code = response.json()["code"]
    assert len(code) == 6

    verify_response = client.post(
        "/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code}
    )
    assert verify_response.status_code == 200


def test_dev_peek_is_case_insensitive_on_email(client, monkeypatch):
    _capture_otp(monkeypatch)
    client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    response = client.get("/api/v1/auth/otp/_dev-peek", params={"email": "Learner@Example.com"})

    assert response.status_code == 200


def test_dev_peek_returns_404_for_unknown_email(client):
    response = client.get("/api/v1/auth/otp/_dev-peek", params={"email": "nobody@example.com"})
    assert response.status_code == 404


def test_dev_peek_returns_404_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")

    response = client.get("/api/v1/auth/otp/_dev-peek", params={"email": "learner@example.com"})

    assert response.status_code == 404


def test_dev_peek_not_populated_when_environment_is_production(client, monkeypatch):
    sent = _capture_otp(monkeypatch)
    monkeypatch.setattr(settings, "environment", "production")

    request_response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})
    assert request_response.status_code == 202
    assert len(sent) == 1

    monkeypatch.setattr(settings, "environment", "development")
    response = client.get("/api/v1/auth/otp/_dev-peek", params={"email": "learner@example.com"})
    assert response.status_code == 404


def test_dev_peek_excluded_from_openapi_schema(client):
    schema = client.get("/openapi.json").json()
    assert "/api/v1/auth/otp/_dev-peek" not in schema["paths"]


def test_verify_otp_happy_path_issues_token_and_creates_user(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)

    response = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]

    user = db_session.query(User).filter_by(email="learner@example.com").one()
    assert user.email == "learner@example.com"


def test_verify_otp_reuses_existing_user(client, db_session, monkeypatch):
    code1 = _request_and_get_code(client, db_session, monkeypatch)
    response1 = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code1})
    assert response1.status_code == 200

    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 0)
    code2 = _request_and_get_code(client, db_session, monkeypatch)
    response2 = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code2})
    assert response2.status_code == 200

    users = db_session.query(User).filter_by(email="learner@example.com").all()
    assert len(users) == 1


def test_verify_otp_is_case_insensitive_and_creates_one_user(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch, email="Learner@Example.com")

    response = client.post("/api/v1/auth/otp/verify", json={"email": "LEARNER@example.com", "code": code})

    assert response.status_code == 200
    assert [u.email for u in db_session.query(User).all()] == ["learner@example.com"]


@pytest.mark.parametrize("code", ["1" * 1000, "abcdef", "12 456", "１２３４５６"])
def test_verify_otp_rejects_malformed_code(client, code):
    response = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})

    assert response.status_code == 422


def test_verify_otp_wrong_code_returns_401(client, db_session, monkeypatch):
    _request_and_get_code(client, db_session, monkeypatch)

    response = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": "000000"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired code"


def test_verify_otp_expired_code_returns_401(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)

    otp = db_session.query(OtpCode).filter_by(email="learner@example.com").one()
    otp.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    response = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})

    assert response.status_code == 401


def test_verify_otp_exhausts_attempts(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)

    for _ in range(5):
        response = client.post(
            "/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": "000000"}
        )
        assert response.status_code == 401

    response = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})
    assert response.status_code == 401


def test_verify_otp_unknown_email_returns_401(client):
    response = client.post("/api/v1/auth/otp/verify", json={"email": "nobody@example.com", "code": "123456"})

    assert response.status_code == 401


def test_verify_otp_sets_httponly_session_cookie(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)

    response = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})

    assert response.status_code == 200
    cookie = next(c for c in response.cookies.jar if c.name == "access_token")
    assert cookie.value == response.json()["access_token"]
    assert cookie.path == "/"
    assert cookie.has_nonstandard_attr("HttpOnly")
    assert cookie.get_nonstandard_attr("SameSite") == "lax"
    # Not Secure here: ENVIRONMENT is "development" in tests, and a Secure
    # cookie would be silently dropped over the plain http:// local dev uses.
    assert not cookie.secure


def test_me_authenticates_via_cookie_alone(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)
    client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "learner@example.com"


def test_logout_clears_the_session_cookie(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)
    client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})

    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    cookie = next((c for c in response.cookies.jar if c.name == "access_token"), None)
    assert cookie is None or cookie.value == ""

    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_without_token_returns_401(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_returns_401(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_me_with_valid_token_returns_current_user(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)
    verify_response = client.post(
        "/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code}
    )
    token = verify_response.json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "learner@example.com"


def test_logout_without_token_returns_401(client):
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 401


def test_logout_revokes_the_token_used_to_call_it(client, auth_headers):
    logout_response = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert logout_response.status_code == 204

    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 401


def test_logout_revokes_tokens_issued_earlier_for_the_same_user(client, db_session, auth_headers):
    # A second, independently minted token for the same user — logging out
    # with the fixture's token must invalidate this one too, since it's the
    # user's token_version that's revoked, not just the one token presented
    # at logout.
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    other_headers = {"Authorization": f"Bearer {create_access_token(user.id, user.token_version)}"}

    logout_response = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert logout_response.status_code == 204

    response = client.get("/api/v1/auth/me", headers=other_headers)
    assert response.status_code == 401


def test_token_issued_after_logout_still_works(client, db_session, auth_headers):
    assert client.post("/api/v1/auth/logout", headers=auth_headers).status_code == 204

    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    new_token = create_access_token(user.id, user.token_version)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert response.status_code == 200


def test_me_without_exam_variant_returns_null(client, auth_headers):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.json()["exam_variant"] is None


def test_update_me_sets_exam_variant(client, db_session, auth_headers):
    response = client.patch("/api/v1/auth/me", json={"exam_variant": "motor"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["exam_variant"] == "motor"

    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    assert user.exam_variant == "motor"


def test_update_me_rejects_unknown_exam_variant(client, auth_headers):
    response = client.patch("/api/v1/auth/me", json={"exam_variant": "rudern"}, headers=auth_headers)
    assert response.status_code == 422


def test_update_me_requires_auth(client):
    response = client.patch("/api/v1/auth/me", json={"exam_variant": "motor"})
    assert response.status_code == 401


def test_update_me_sets_first_and_last_name(client, db_session, auth_headers):
    response = client.patch(
        "/api/v1/auth/me", json={"first_name": "Anna", "last_name": "Beispiel"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["first_name"] == "Anna"
    assert response.json()["last_name"] == "Beispiel"

    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    assert user.first_name == "Anna"
    assert user.last_name == "Beispiel"


def test_update_me_strips_names_and_stores_blank_as_null(client, db_session, auth_headers):
    response = client.patch(
        "/api/v1/auth/me", json={"first_name": "  Anna  ", "last_name": "   "}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["first_name"] == "Anna"
    assert response.json()["last_name"] is None
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    assert user.first_name == "Anna"
    assert user.last_name is None


def test_update_me_sets_gender(client, auth_headers):
    response = client.patch("/api/v1/auth/me", json={"gender": "weiblich"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["gender"] == "weiblich"


def test_update_me_rejects_unknown_gender(client, auth_headers):
    response = client.patch("/api/v1/auth/me", json={"gender": "unbekannt"}, headers=auth_headers)
    assert response.status_code == 422


def test_update_me_clears_a_field_with_explicit_null(client, db_session, auth_headers):
    client.patch("/api/v1/auth/me", json={"first_name": "Anna"}, headers=auth_headers)

    response = client.patch("/api/v1/auth/me", json={"first_name": None}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["first_name"] is None
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    assert user.first_name is None


def test_update_me_partial_update_leaves_other_fields_untouched(client, auth_headers):
    client.patch("/api/v1/auth/me", json={"first_name": "Anna"}, headers=auth_headers)

    response = client.patch("/api/v1/auth/me", json={"last_name": "Beispiel"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["first_name"] == "Anna"
    assert response.json()["last_name"] == "Beispiel"


def test_update_me_empty_body_is_a_noop(client, auth_headers):
    client.patch("/api/v1/auth/me", json={"exam_variant": "motor"}, headers=auth_headers)

    response = client.patch("/api/v1/auth/me", json={}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["exam_variant"] == "motor"


def test_delete_me_removes_user_and_cascades_progress(client, db_session, auth_headers):
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    user_id = user.id
    question = Question(subject="navigation", number=1, question_text="Q?", answer_text="A")
    db_session.add(question)
    db_session.commit()
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(1)))
    db_session.commit()

    response = client.delete("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(User, user_id) is None
    assert db_session.query(QuestionProgress).filter_by(user_id=user_id).count() == 0


def test_delete_me_clears_the_session_cookie(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)
    client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})

    response = client.delete("/api/v1/auth/me")

    assert response.status_code == 204
    cookie = next((c for c in response.cookies.jar if c.name == "access_token"), None)
    assert cookie is None or cookie.value == ""


def test_delete_me_requires_auth(client):
    response = client.delete("/api/v1/auth/me")
    assert response.status_code == 401


def _capture_email_change_otp(monkeypatch):
    sent = []

    def fake_send(to_email, code):
        sent.append((to_email, code))

    monkeypatch.setattr("app.services.email.send_email_change_otp_email", fake_send)
    return sent


def _request_email_change_and_get_code(client, monkeypatch, auth_headers, new_email="new@example.com"):
    sent = _capture_email_change_otp(monkeypatch)
    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": new_email}, headers=auth_headers
    )
    assert response.status_code == 202
    assert len(sent) == 1
    return sent[0][1]


def test_request_email_change_sends_code_to_new_address(client, monkeypatch, auth_headers):
    sent = _capture_email_change_otp(monkeypatch)

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "new@example.com"}, headers=auth_headers
    )

    assert response.status_code == 202
    assert len(sent) == 1
    assert sent[0][0] == "new@example.com"


def test_request_email_change_rejects_a_no_op(client, auth_headers):
    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "fixture-user@example.com"}, headers=auth_headers
    )
    assert response.status_code == 400


def test_request_email_change_rejects_a_disposable_address(client, db_session, monkeypatch, auth_headers):
    sent = _capture_email_change_otp(monkeypatch)

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "someone@mailinator.com"}, headers=auth_headers
    )

    assert response.status_code == 400
    assert sent == []
    assert db_session.query(OtpCode).count() == 0


def test_request_email_change_rejects_email_already_taken_by_another_user(client, db_session, auth_headers):
    db_session.add(User(email="taken@example.com"))
    db_session.commit()

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "taken@example.com"}, headers=auth_headers
    )

    assert response.status_code == 409


def test_request_email_change_requires_auth(client):
    response = client.post("/api/v1/auth/me/email/request", json={"new_email": "new@example.com"})
    assert response.status_code == 401


def test_request_email_change_per_user_rate_limit(client, monkeypatch, auth_headers):
    monkeypatch.setattr(settings, "email_change_max_requests_per_window", 2)
    _capture_email_change_otp(monkeypatch)

    for i in range(2):
        response = client.post(
            "/api/v1/auth/me/email/request", json={"new_email": f"new{i}@example.com"}, headers=auth_headers
        )
        assert response.status_code == 202

    # Third distinct target address from the same authenticated user, still
    # within the window — this is exactly the enumeration path the per-user
    # cap exists for, and a per-IP-only limit wouldn't catch it since all
    # three requests share both the same IP and the same account.
    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "new2@example.com"}, headers=auth_headers
    )
    assert response.status_code == 429


def test_request_email_change_ip_rate_limited_across_different_target_emails(
    client, monkeypatch, auth_headers
):
    # Isolates the per-IP cap (app/main.py's rules entry) from the per-user
    # cap tested above, which would otherwise trip first.
    monkeypatch.setattr(settings, "email_change_max_requests_per_window", 1000)
    _capture_email_change_otp(monkeypatch)

    for i in range(20):
        response = client.post(
            "/api/v1/auth/me/email/request", json={"new_email": f"flood{i}@example.com"}, headers=auth_headers
        )
        assert response.status_code == 202

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "flood20@example.com"}, headers=auth_headers
    )
    assert response.status_code == 429


def test_verify_email_change_updates_user_email(client, db_session, monkeypatch, auth_headers):
    code = _request_email_change_and_get_code(client, monkeypatch, auth_headers)

    response = client.post(
        "/api/v1/auth/me/email/verify",
        json={"new_email": "new@example.com", "code": code},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["email"] == "new@example.com"
    user = db_session.query(User).filter_by(email="new@example.com").one()
    assert user.email == "new@example.com"


def test_verify_email_change_wrong_code_returns_400(client, monkeypatch, auth_headers):
    _request_email_change_and_get_code(client, monkeypatch, auth_headers)

    response = client.post(
        "/api/v1/auth/me/email/verify",
        json={"new_email": "new@example.com", "code": "000000"},
        headers=auth_headers,
    )

    assert response.status_code == 400


def test_verify_email_change_race_on_uniqueness_returns_409(client, db_session, monkeypatch, auth_headers):
    code = _request_email_change_and_get_code(client, monkeypatch, auth_headers)
    # Simulate another account claiming the exact same address between the
    # request-time check and this verify call.
    db_session.add(User(email="new@example.com"))
    db_session.commit()

    response = client.post(
        "/api/v1/auth/me/email/verify",
        json={"new_email": "new@example.com", "code": code},
        headers=auth_headers,
    )

    assert response.status_code == 409


def test_verify_email_change_requires_auth(client):
    response = client.post(
        "/api/v1/auth/me/email/verify", json={"new_email": "new@example.com", "code": "123456"}
    )
    assert response.status_code == 401


def test_request_email_change_taken_addresses_count_toward_per_user_limit(
    client, db_session, monkeypatch, auth_headers
):
    # The per-user cap exists to stop one account probing which addresses
    # are taken — so a probe that *finds* a taken address (409) must consume
    # quota too, not just the ones that go on to send a code.
    monkeypatch.setattr(settings, "email_change_max_requests_per_window", 2)
    for i in range(3):
        db_session.add(User(email=f"taken{i}@example.com"))
    db_session.commit()

    for i in range(2):
        response = client.post(
            "/api/v1/auth/me/email/request", json={"new_email": f"taken{i}@example.com"}, headers=auth_headers
        )
        assert response.status_code == 409

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "taken2@example.com"}, headers=auth_headers
    )
    assert response.status_code == 429


def test_request_email_change_rejects_address_outside_the_allowlist(client, monkeypatch, auth_headers):
    # Otherwise a beta user could move their account to an address that
    # /otp/request silently ignores — and never be able to log in again once
    # the current session expires.
    sent = _capture_email_change_otp(monkeypatch)
    monkeypatch.setattr(settings, "allowed_emails", "fixture-user@example.com, Allowed@Example.com")

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "outsider@example.com"}, headers=auth_headers
    )
    assert response.status_code == 403
    assert sent == []

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "allowed@example.com"}, headers=auth_headers
    )
    assert response.status_code == 202
    assert len(sent) == 1


def test_email_change_code_cannot_be_used_to_log_in(client, db_session, monkeypatch, auth_headers):
    # Otherwise an allowlisted user could mint a login (and a brand-new
    # account) for any address they control, bypassing ALLOWED_EMAILS.
    code = _request_email_change_and_get_code(client, monkeypatch, auth_headers)

    response = client.post("/api/v1/auth/otp/verify", json={"email": "new@example.com", "code": code})

    assert response.status_code == 401
    assert db_session.query(User).filter_by(email="new@example.com").count() == 0


def test_login_code_cannot_be_used_for_an_email_change(client, db_session, monkeypatch, auth_headers):
    code = _request_and_get_code(client, db_session, monkeypatch, email="new@example.com")

    response = client.post(
        "/api/v1/auth/me/email/verify",
        json={"new_email": "new@example.com", "code": code},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert db_session.query(User).filter_by(email="fixture-user@example.com").count() == 1


def test_email_change_requests_do_not_block_login_codes_for_that_address(
    client, db_session, monkeypatch, auth_headers
):
    # Separate quotas per purpose: someone else's email-change request to an
    # address must neither trip that address's login cooldown nor use up its
    # hourly login-code cap.
    monkeypatch.setattr(settings, "otp_max_requests_per_window", 1)
    _request_email_change_and_get_code(client, monkeypatch, auth_headers)

    login_sent = _capture_otp(monkeypatch)
    response = client.post("/api/v1/auth/otp/request", json={"email": "new@example.com"})

    assert response.status_code == 202
    assert len(login_sent) == 1


def test_update_me_rejects_overlong_names(client, auth_headers):
    # users.first_name/last_name are VARCHAR(128) — Postgres would raise on
    # anything longer (SQLite, used here, wouldn't), so it must be a 422.
    for field in ("first_name", "last_name"):
        response = client.patch("/api/v1/auth/me", json={field: "a" * 129}, headers=auth_headers)
        assert response.status_code == 422

    response = client.patch("/api/v1/auth/me", json={"first_name": "a" * 128}, headers=auth_headers)
    assert response.status_code == 200


def test_delete_me_removes_pending_otp_codes_for_the_address(client, db_session, monkeypatch, auth_headers):
    _request_and_get_code(client, db_session, monkeypatch, email="fixture-user@example.com")
    assert db_session.query(OtpCode).filter_by(email="fixture-user@example.com").count() == 1

    response = client.delete("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.query(OtpCode).filter_by(email="fixture-user@example.com").count() == 0


def test_delete_me_removes_pending_email_change_codes_for_another_address(
    client, db_session, monkeypatch, auth_headers
):
    _request_email_change_and_get_code(client, monkeypatch, auth_headers, new_email="new@example.com")
    assert db_session.query(OtpCode).filter_by(email="new@example.com").count() == 1

    response = client.delete("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.query(OtpCode).filter_by(email="new@example.com").count() == 0


def test_email_change_code_is_bound_to_the_requesting_account(client, db_session, monkeypatch, auth_headers):
    code = _request_email_change_and_get_code(client, monkeypatch, auth_headers, new_email="new@example.com")

    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(other.id, other.token_version)}"}

    response = client.post(
        "/api/v1/auth/me/email/verify",
        json={"new_email": "new@example.com", "code": code},
        headers=other_headers,
    )
    assert response.status_code == 400

    # The other account's attempt didn't touch the requester's code — it
    # still works for the account that asked for it.
    response = client.post(
        "/api/v1/auth/me/email/verify",
        json={"new_email": "new@example.com", "code": code},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert db_session.query(OtpCode).filter_by(email="new@example.com").one().attempts == 0


def test_generated_otp_codes_are_all_digits_of_the_configured_length():
    from app.core.config import settings
    from app.core.otp import generate_code

    codes = [generate_code() for _ in range(300)]
    assert all(code.isdigit() and len(code) == settings.otp_length for code in codes)


def test_a_login_code_works_only_once(client, db_session, monkeypatch):
    code = _request_and_get_code(client, db_session, monkeypatch)
    payload = {"email": "learner@example.com", "code": code}

    assert client.post("/api/v1/auth/otp/verify", json=payload).status_code == 200
    assert client.post("/api/v1/auth/otp/verify", json=payload).status_code == 401


def test_each_wrong_guess_counts_exactly_once_against_the_attempt_limit(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "otp_max_attempts", 3)
    code = _request_and_get_code(client, db_session, monkeypatch)
    wrong = "000000" if code != "000000" else "111111"

    for _ in range(2):
        assert (
            client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": wrong})
        ).status_code == 401
    # Two of three attempts are used: the right code still works.
    right = client.post("/api/v1/auth/otp/verify", json={"email": "learner@example.com", "code": code})
    assert right.status_code == 200


def test_the_resend_cooldown_is_per_address(client, monkeypatch):
    sent = _capture_otp(monkeypatch)
    for email in ("first@example.com", "second@example.com"):
        assert client.post("/api/v1/auth/otp/request", json={"email": email}).status_code == 202
    assert [to for to, _ in sent] == ["first@example.com", "second@example.com"]


def test_auth_as_utc_treats_naive_as_utc_and_leaves_aware_values_alone():
    from datetime import UTC, datetime, timedelta, timezone

    from app.api.v1.auth import _as_utc

    assert _as_utc(datetime(2026, 1, 1, 12, 0)) == datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    aware = datetime(2026, 1, 1, 12, 0, tzinfo=timezone(timedelta(hours=2)))
    assert _as_utc(aware) is aware


def test_the_email_change_cap_is_per_user(client, db_session, monkeypatch, auth_headers):
    monkeypatch.setattr(settings, "email_change_max_requests_per_window", 1)
    _capture_email_change_otp(monkeypatch)
    other = User(email="other@example.com")
    db_session.add(other)
    db_session.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(other.id, other.token_version)}"}

    def request_change(headers, address):
        return client.post("/api/v1/auth/me/email/request", json={"new_email": address}, headers=headers)

    assert request_change(auth_headers, "one@example.com").status_code == 202
    assert request_change(auth_headers, "two@example.com").status_code == 429
    assert request_change(other_headers, "three@example.com").status_code == 202


def test_the_hourly_code_quota_is_per_address(client, monkeypatch):
    monkeypatch.setattr(settings, "otp_max_requests_per_window", 1)
    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 0)
    sent = _capture_otp(monkeypatch)

    for email in ("first@example.com", "second@example.com", "first@example.com"):
        assert client.post("/api/v1/auth/otp/request", json={"email": email}).status_code == 202

    # The third request is silently dropped: first@ already used its one code this hour.
    assert [to for to, _ in sent] == ["first@example.com", "second@example.com"]
