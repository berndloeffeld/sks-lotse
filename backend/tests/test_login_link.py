"""The login link in the code email (ADR-0064): POST /auth/otp/verify-link."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.core.otp import hash_link_token
from app.models import OtpCode, User
from app.services import blocklist
from tests.helpers import TOKEN_IN_BODY

EMAIL = "learner@example.com"


@pytest.fixture()
def sent(monkeypatch):
    calls = []

    def fake_send(to_email, code, link_token=None, *, site):
        calls.append((to_email, code, link_token))

    monkeypatch.setattr("app.services.email.send_otp_email", fake_send)
    return calls


def _request(client, sent, email=EMAIL):
    assert client.post("/api/v1/auth/otp/request", json={"email": email}).status_code == 202
    _, code, link_token = sent[-1]
    return code, link_token


def _verify_link(client, token, **kwargs):
    return client.post("/api/v1/auth/otp/verify-link", json={"token": token}, **kwargs)


def test_the_login_email_gets_a_link_token_stored_only_as_its_hash(client, db_session, sent):
    _, link_token = _request(client, sent)

    assert len(link_token) == 43
    otp = db_session.query(OtpCode).filter_by(email=EMAIL).one()
    assert otp.link_hash == hash_link_token(link_token)
    assert link_token not in otp.link_hash


def test_the_link_signs_in_and_creates_the_account(client, db_session, sent):
    _, link_token = _request(client, sent)

    response = _verify_link(client, link_token, headers=TOKEN_IN_BODY)

    assert response.status_code == 200
    assert response.json()["access_token"]
    user = db_session.query(User).filter_by(email=EMAIL).one()
    assert user.last_login_at is not None
    assert client.get("/api/v1/auth/me").json()["email"] == EMAIL


def test_the_link_sets_the_session_cookie_and_no_token_in_the_body(client, sent):
    _, link_token = _request(client, sent)

    response = _verify_link(client, link_token)

    assert response.status_code == 200
    assert response.json()["access_token"] is None
    assert "httponly" in response.headers["set-cookie"].lower()


def test_the_link_works_once(client, sent):
    _, link_token = _request(client, sent)
    assert _verify_link(client, link_token).status_code == 200

    response = _verify_link(client, link_token)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired code"


def test_the_code_and_the_link_are_one_login(client, sent):
    # Redeeming either uses up the other: they are the same otp_codes row.
    code, link_token = _request(client, sent)
    assert client.post("/api/v1/auth/otp/verify", json={"email": EMAIL, "code": code}).status_code == 200

    assert _verify_link(client, link_token).status_code == 401


def test_after_the_link_the_code_is_used_up_too(client, sent):
    code, link_token = _request(client, sent)
    assert _verify_link(client, link_token).status_code == 200

    response = client.post("/api/v1/auth/otp/verify", json={"email": EMAIL, "code": code})

    assert response.status_code == 401


def test_an_expired_link_is_rejected(client, db_session, sent):
    _, link_token = _request(client, sent)
    otp = db_session.query(OtpCode).filter_by(email=EMAIL).one()
    otp.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    assert _verify_link(client, link_token).status_code == 401


def test_only_the_latest_link_counts(client, monkeypatch, sent):
    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 0)
    _, older = _request(client, sent)
    _, newer = _request(client, sent)

    assert _verify_link(client, older).status_code == 401
    assert _verify_link(client, newer).status_code == 200


def test_wrong_code_guesses_dont_take_the_link_down(client, sent):
    # The attempts cap guards the 6-digit code; someone burning it for the victim's address must
    # not also kill the victim's 256-bit link.
    _, link_token = _request(client, sent)
    for _ in range(settings.otp_max_attempts):
        client.post("/api/v1/auth/otp/verify", json={"email": EMAIL, "code": "000000"})

    assert _verify_link(client, link_token).status_code == 200


def test_an_unknown_token_is_rejected(client):
    assert _verify_link(client, "x" * 43).status_code == 401


@pytest.mark.parametrize("token", ["", "x" * 42, "x" * 44])
def test_a_malformed_token_is_a_422(client, token):
    assert _verify_link(client, token).status_code == 422


def test_a_link_requested_before_the_block_opens_no_session(client, db_session, sent):
    _, link_token = _request(client, sent, email="late@spammy.example")
    blocklist.add_block(db_session, "domain", "spammy.example", None, "admin@example.com")
    blocklist.commit(db_session, client.app)

    response = _verify_link(client, link_token)

    assert response.status_code == 401
    assert db_session.query(User).filter_by(email="late@spammy.example").count() == 0


def test_an_email_change_code_carries_no_link(client, db_session, monkeypatch, auth_headers):
    monkeypatch.setattr(
        "app.services.email.send_email_change_otp_email", lambda to_email, code, *, site: None
    )

    response = client.post(
        "/api/v1/auth/me/email/request", json={"new_email": "new@example.com"}, headers=auth_headers
    )

    assert response.status_code == 202
    otp = db_session.query(OtpCode).filter_by(email="new@example.com").one()
    assert otp.link_hash is None


def test_the_dev_peek_hands_out_the_link_token(client, sent):
    _, link_token = _request(client, sent)

    response = client.get("/api/v1/auth/otp/_dev-peek", params={"email": EMAIL})

    assert response.json()["link_token"] == link_token


def test_verify_link_is_rate_limited_per_ip(client):
    limit = settings.rate_limit_otp_verify_max_requests
    statuses = [_verify_link(client, "x" * 43).status_code for _ in range(limit + 1)]

    assert statuses[:limit] == [401] * limit
    assert statuses[limit] == 429
