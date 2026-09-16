from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.core.jwt import create_access_token
from app.models import OtpCode, User


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
        code_hash="irrelevant",
        expires_at=now - timedelta(hours=settings.otp_code_retention_hours, minutes=1),
    )
    recent = OtpCode(
        email="old@example.com",
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
