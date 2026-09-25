import time
from datetime import UTC, datetime

import jwt
import pyotp
import pytest
from sqlalchemy.orm import sessionmaker

from app.core import totp
from app.core.config import settings
from app.core.jwt import MFA_REQUIRED, create_access_token
from app.models import User
from app.services import admin_mfa
from scripts import reset_admin_totp
from tests.helpers import FIXTURE_EMAIL, fixture_user, make_admin

_STATUS = "/api/v1/admin/mfa/status"
_ENROL = "/api/v1/admin/mfa/enrol"
_VERIFY = "/api/v1/admin/mfa/verify"
_ADMIN_ROUTE = "/api/v1/admin/users"


def _headers(user: User, mfa_at: int | None = None) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.token_version, mfa_at)}"}


@pytest.fixture()
def admin(db_session, auth_headers, monkeypatch) -> User:
    make_admin(monkeypatch)
    return fixture_user(db_session)


@pytest.fixture()
def no_mfa(admin) -> dict:
    """An admin's session straight after the email login — no TOTP check yet."""
    return _headers(admin)


def _enrol(client, headers) -> str:
    response = client.post(_ENROL, headers=headers)
    assert response.status_code == 200
    return response.json()["secret"]


def _enrolled_secret(db_session, admin: User) -> str:
    secret = totp.new_secret()
    admin.totp_secret_encrypted = totp.encrypt_secret(secret)
    admin.totp_enabled_at = datetime.now(UTC)
    db_session.commit()
    return secret


def test_admin_routes_need_the_second_factor(client, no_mfa):
    response = client.get(_ADMIN_ROUTE, headers=no_mfa)
    assert response.status_code == 403
    assert response.json()["detail"] == MFA_REQUIRED


def test_an_expired_second_factor_no_longer_opens_the_admin_area(client, admin, monkeypatch):
    monkeypatch.setattr(settings, "admin_mfa_max_age_minutes", 60)
    stale = _headers(admin, mfa_at=int(time.time()) - 3601)
    assert client.get(_ADMIN_ROUTE, headers=stale).json()["detail"] == MFA_REQUIRED
    assert client.get(_STATUS, headers=stale).json() == {"enrolled": False, "verified": False}


def test_a_fresh_second_factor_opens_the_admin_area(client, admin):
    assert client.get(_ADMIN_ROUTE, headers=_headers(admin, mfa_at=int(time.time()))).status_code == 200


def test_the_mfa_routes_reject_learners(client, auth_headers):
    assert client.get(_STATUS, headers=auth_headers).status_code == 403


def test_status_before_enrolment(client, no_mfa):
    assert client.get(_STATUS, headers=no_mfa).json() == {"enrolled": False, "verified": False}


def test_enrolment_confirm_opens_the_admin_area(client, db_session, admin, no_mfa, caplog):
    caplog.set_level("INFO")
    response = client.post(_ENROL, headers=no_mfa)
    assert response.status_code == 200
    body = response.json()
    assert body["otpauth_uri"].startswith("otpauth://totp/SKS%20Lotse:")
    assert body["qr_code"].startswith("data:image/svg+xml")
    # Pending until a code confirms it.
    assert client.get(_STATUS, headers=no_mfa).json() == {"enrolled": False, "verified": False}
    db_session.refresh(admin)
    assert body["secret"] not in admin.totp_secret_encrypted

    response = client.post(_VERIFY, headers=no_mfa, json={"code": pyotp.TOTP(body["secret"]).now()})
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert "access_token" in response.cookies
    db_session.refresh(admin)
    assert admin.totp_enabled_at is not None
    assert f"admin 2fa enabled: admin={admin.id}" in caplog.text

    upgraded = {"Authorization": f"Bearer {token}"}
    assert client.get(_STATUS, headers=upgraded).json() == {"enrolled": True, "verified": True}
    assert client.get(_ADMIN_ROUTE, headers=upgraded).status_code == 200
    # The old token still works for learning, just not for the admin area.
    client.cookies.clear()  # the cookie (the new session) would win over the Bearer header
    assert client.get(_STATUS, headers=no_mfa).json() == {"enrolled": True, "verified": False}
    assert client.get("/api/v1/auth/me", headers=no_mfa).status_code == 200


def test_the_upgraded_session_keeps_user_and_token_version(client, admin, no_mfa):
    secret = _enrol(client, no_mfa)
    response = client.post(_VERIFY, headers=no_mfa, json={"code": pyotp.TOTP(secret).now()})
    token = response.json()["access_token"]
    claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    assert claims["sub"] == str(admin.id)
    assert claims["tv"] == admin.token_version
    assert abs(claims["mfa"] - time.time()) < 5


def test_enrolling_again_replaces_a_pending_secret(client, no_mfa):
    first = _enrol(client, no_mfa)
    second = _enrol(client, no_mfa)
    assert first != second
    assert client.post(_VERIFY, headers=no_mfa, json={"code": pyotp.TOTP(first).now()}).status_code == 400
    assert client.post(_VERIFY, headers=no_mfa, json={"code": pyotp.TOTP(second).now()}).status_code == 200


def test_enrolment_cannot_replace_an_active_secret(client, db_session, admin, no_mfa):
    _enrolled_secret(db_session, admin)
    response = client.post(_ENROL, headers=no_mfa)
    assert response.status_code == 409
    assert response.json()["detail"] == "2FA is already enabled"


def test_step_up_with_an_active_secret(client, db_session, admin, no_mfa, caplog):
    caplog.set_level("INFO")
    secret = _enrolled_secret(db_session, admin)
    assert client.get(_STATUS, headers=no_mfa).json() == {"enrolled": True, "verified": False}
    response = client.post(_VERIFY, headers=no_mfa, json={"code": pyotp.TOTP(secret).now()})
    assert response.status_code == 200
    upgraded = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get(_ADMIN_ROUTE, headers=upgraded).status_code == 200
    # Only switching 2FA on is logged, not every step-up.
    assert "admin 2fa enabled" not in caplog.text


def test_a_code_cannot_be_used_twice(client, db_session, admin, no_mfa):
    secret = _enrolled_secret(db_session, admin)
    code = pyotp.TOTP(secret).now()
    assert client.post(_VERIFY, headers=no_mfa, json={"code": code}).status_code == 200
    assert client.post(_VERIFY, headers=no_mfa, json={"code": code}).status_code == 400


def test_a_wrong_code_is_a_400_not_a_logout(client, db_session, admin, no_mfa):
    secret = _enrolled_secret(db_session, admin)
    wrong = f"{(int(pyotp.TOTP(secret).now()) + 1) % 1_000_000:06d}"
    response = client.post(_VERIFY, headers=no_mfa, json={"code": wrong})
    assert response.status_code == 400
    assert "access_token" not in response.cookies


def test_verify_without_any_enrolment_is_a_400(client, no_mfa):
    assert client.post(_VERIFY, headers=no_mfa, json={"code": "123456"}).status_code == 400


@pytest.mark.parametrize("code", ["12345", "1234567", "abcdef", "123 456"])
def test_a_malformed_code_is_a_422(client, no_mfa, code):
    assert client.post(_VERIFY, headers=no_mfa, json={"code": code}).status_code == 422


def test_verify_attempts_are_capped_per_admin(client, db_session, admin, no_mfa, monkeypatch, caplog):
    monkeypatch.setattr(settings, "admin_mfa_max_attempts_per_window", 2)
    secret = _enrolled_secret(db_session, admin)
    for _ in range(2):
        assert client.post(_VERIFY, headers=no_mfa, json={"code": "000000"}).status_code in (200, 400)
    # Over the cap, even the right code is refused.
    response = client.post(_VERIFY, headers=no_mfa, json={"code": pyotp.TOTP(secret).now()})
    assert response.status_code == 429
    assert response.json()["detail"] == "Too many attempts"
    assert f"admin 2fa: too many attempts admin={admin.id}" in caplog.text


def test_the_attempt_cap_is_per_admin_and_per_window(client, db_session, admin, no_mfa, monkeypatch):
    monkeypatch.setattr(settings, "admin_mfa_max_attempts_per_window", 1)
    monkeypatch.setattr(settings, "admin_mfa_window_seconds", 0)
    secret = _enrolled_secret(db_session, admin)
    assert client.post(_VERIFY, headers=no_mfa, json={"code": "000000"}).status_code in (200, 400)
    # A zero-second window has already passed: the next attempt counts afresh.
    assert client.post(_VERIFY, headers=no_mfa, json={"code": pyotp.TOTP(secret).now()}).status_code == 200


def test_a_secret_unreadable_after_jwt_secret_rotation_is_refused(client, db_session, admin, monkeypatch):
    secret = _enrolled_secret(db_session, admin)
    monkeypatch.setattr(settings, "jwt_secret", "r" * 40)
    headers = _headers(admin)
    assert client.post(_VERIFY, headers=headers, json={"code": pyotp.TOTP(secret).now()}).status_code == 400


def test_logout_ends_the_second_factor_too(client, db_session, admin):
    secret = _enrolled_secret(db_session, admin)
    token = client.post(_VERIFY, headers=_headers(admin), json={"code": pyotp.TOTP(secret).now()}).json()[
        "access_token"
    ]
    upgraded = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/v1/auth/logout", headers=upgraded).status_code in (200, 204)
    assert client.get(_ADMIN_ROUTE, headers=upgraded).status_code == 401


def test_export_shows_when_2fa_was_enabled_but_never_the_secret(client, db_session, admin):
    _enrolled_secret(db_session, admin)
    headers = _headers(admin, mfa_at=int(time.time()))
    body = client.get(f"/api/v1/admin/users/{admin.id}/export", headers=headers).json()
    assert body["user"]["totp_enabled_at"] is not None
    assert "totp_secret_encrypted" not in body["user"]
    assert "totp_last_counter" not in body["user"]


def test_reset_clears_2fa_and_ends_sessions(db_session, admin):
    _enrolled_secret(db_session, admin)
    admin.totp_last_counter = 42
    version = admin.token_version
    assert admin_mfa.reset(db_session, admin) is True
    assert admin.totp_secret_encrypted is None
    assert admin.totp_enabled_at is None
    assert admin.totp_last_counter is None
    assert admin.token_version == version + 1


def test_reset_without_2fa_reports_nothing_to_reset(db_session, admin):
    assert admin_mfa.reset(db_session, admin) is False


@pytest.fixture()
def script_db(db_session, monkeypatch):
    factory = sessionmaker(bind=db_session.get_bind())
    monkeypatch.setattr(reset_admin_totp, "get_session_factory", lambda: factory)
    return db_session


def test_reset_script_resets_by_canonical_email(script_db, admin, capsys):
    _enrolled_secret(script_db, admin)
    assert reset_admin_totp.main(["--email", FIXTURE_EMAIL.upper()]) == 0
    assert "2FA reset" in capsys.readouterr().out
    script_db.refresh(admin)
    assert admin.totp_secret_encrypted is None


def test_reset_script_without_2fa(script_db, admin, capsys):
    assert reset_admin_totp.main(["--email", FIXTURE_EMAIL]) == 0
    assert "had no 2FA" in capsys.readouterr().out


def test_reset_script_unknown_email(script_db, capsys):
    assert reset_admin_totp.main(["--email", "nobody@example.com"]) == 0
    assert "No account" in capsys.readouterr().out


def test_the_upgraded_session_cookie_has_the_session_attributes(client, db_session, admin, monkeypatch):
    monkeypatch.setattr(settings, "jwt_access_token_expires_minutes", 90)
    secret = _enrolled_secret(db_session, admin)
    response = client.post(_VERIFY, headers=_headers(admin), json={"code": pyotp.TOTP(secret).now()})
    cookie = response.headers["set-cookie"].lower()
    assert "max-age=5400" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert "secure" not in cookie  # plain http:// in local dev; production sets it
