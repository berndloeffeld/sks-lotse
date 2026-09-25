from datetime import UTC, datetime, timedelta

import pyotp
import pytest

from app.core import totp
from app.core.config import settings

_NOW = datetime(2026, 9, 25, 12, 0, 0, tzinfo=UTC)


def _code(secret: str, at: datetime) -> str:
    return pyotp.TOTP(secret).at(at)


def test_encrypted_secret_round_trips_and_is_not_stored_in_plain():
    secret = totp.new_secret()
    encrypted = totp.encrypt_secret(secret)
    assert secret not in encrypted
    assert totp.decrypt_secret(encrypted) == secret


def test_a_secret_encrypted_under_another_jwt_secret_is_unreadable(monkeypatch):
    encrypted = totp.encrypt_secret(totp.new_secret())
    monkeypatch.setattr(settings, "jwt_secret", "y" * 40)
    assert totp.decrypt_secret(encrypted) is None


def test_provisioning_uri_names_the_issuer_and_account():
    uri = totp.provisioning_uri("JBSWY3DPEHPK3PXP", "admin@example.com")
    assert uri.startswith("otpauth://totp/SKS%20Lotse:admin%40example.com?")
    assert "secret=JBSWY3DPEHPK3PXP" in uri
    assert "issuer=SKS%20Lotse" in uri


def test_qr_code_is_an_svg_data_uri():
    assert totp.qr_data_uri("otpauth://totp/x?secret=A").startswith("data:image/svg+xml")


def test_current_code_is_accepted_and_returns_its_time_step():
    secret = totp.new_secret()
    counter = totp.accepted_counter(secret, _code(secret, _NOW), None, _NOW)
    assert counter == pyotp.TOTP(secret).timecode(_NOW)


@pytest.mark.parametrize("offset_seconds", [-30, 30])
def test_one_step_of_clock_drift_either_way_is_accepted(offset_seconds):
    secret = totp.new_secret()
    code = _code(secret, _NOW + timedelta(seconds=offset_seconds))
    assert totp.accepted_counter(secret, code, None, _NOW) == pyotp.TOTP(secret).timecode(_NOW) + (
        offset_seconds // 30
    )


@pytest.mark.parametrize("offset_seconds", [-60, 60])
def test_two_steps_of_drift_are_refused(offset_seconds):
    secret = totp.new_secret()
    code = _code(secret, _NOW + timedelta(seconds=offset_seconds))
    assert totp.accepted_counter(secret, code, None, _NOW) is None


def test_a_wrong_code_is_refused():
    secret = totp.new_secret()
    wrong = f"{(int(_code(secret, _NOW)) + 1) % 1_000_000:06d}"
    assert totp.accepted_counter(secret, wrong, None, _NOW) is None


def test_a_code_is_not_accepted_twice():
    secret = totp.new_secret()
    code = _code(secret, _NOW)
    counter = totp.accepted_counter(secret, code, None, _NOW)
    assert totp.accepted_counter(secret, code, counter, _NOW) is None


def test_an_older_step_than_the_last_accepted_one_is_refused():
    secret = totp.new_secret()
    current = pyotp.TOTP(secret).timecode(_NOW)
    previous_code = _code(secret, _NOW - timedelta(seconds=30))
    assert totp.accepted_counter(secret, previous_code, current, _NOW) is None
    assert totp.accepted_counter(secret, previous_code, current - 2, _NOW) == current - 1


def test_the_step_right_after_the_last_accepted_one_is_still_accepted():
    secret = totp.new_secret()
    current = pyotp.TOTP(secret).timecode(_NOW)
    assert totp.accepted_counter(secret, _code(secret, _NOW), current - 1, _NOW) == current


def test_spaces_in_the_code_are_ignored():
    secret = totp.new_secret()
    code = _code(secret, _NOW)
    assert totp.accepted_counter(secret, f"{code[:3]} {code[3:]}", None, _NOW) is not None


def test_mfa_is_fresh_within_the_max_age(monkeypatch):
    monkeypatch.setattr(settings, "admin_mfa_max_age_minutes", 60)
    now_ts = int(_NOW.timestamp())
    assert totp.mfa_is_fresh(now_ts, _NOW)
    assert totp.mfa_is_fresh(now_ts - 3600, _NOW)
    assert not totp.mfa_is_fresh(now_ts - 3601, _NOW)


@pytest.mark.parametrize("claim", [None, "123", 1.5, True])
def test_mfa_claim_of_the_wrong_type_is_not_fresh(claim):
    assert not totp.mfa_is_fresh(claim, _NOW)


def test_mfa_claim_from_the_future_is_not_fresh():
    assert not totp.mfa_is_fresh(int(_NOW.timestamp()) + 1, _NOW)
