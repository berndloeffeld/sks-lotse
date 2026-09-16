from datetime import UTC, datetime, timedelta

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


def test_request_otp_within_cooldown_skips_second_send(client, monkeypatch):
    sent = _capture_otp(monkeypatch)

    first = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})
    second = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert first.status_code == 202
    assert second.status_code == 202
    assert len(sent) == 1


def test_request_otp_throttled_after_max_requests_per_window(client, db_session, monkeypatch):
    sent = _capture_otp(monkeypatch)
    monkeypatch.setattr("app.api.v1.auth.OTP_RESEND_COOLDOWN_SECONDS", 0)

    for _ in range(5):
        response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})
        assert response.status_code == 202
    assert len(sent) == 5

    response = client.post("/api/v1/auth/otp/request", json={"email": "learner@example.com"})

    assert response.status_code == 202
    assert len(sent) == 5


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

    monkeypatch.setattr("app.api.v1.auth.OTP_RESEND_COOLDOWN_SECONDS", 0)
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
