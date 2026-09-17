import pytest
from pydantic import ValidationError

from app.core.config import MIN_JWT_SECRET_LENGTH, Settings

_LONG_ENOUGH_SECRET = "a" * MIN_JWT_SECRET_LENGTH


@pytest.mark.parametrize("environment", ["development", "test", "production"])
@pytest.mark.parametrize("secret", ["", "change-me", "test-secret-not-for-production"])
def test_rejects_empty_or_short_secret_in_every_environment(environment, secret):
    # Length-based, not an exact-string blocklist — these deliberately aren't
    # strings this project happens to use elsewhere, to prove the check
    # generalizes rather than only catching known values. Enforced outside
    # production too, so `JWT_SECRET=` copied from .env.example fails loudly.
    assert len(secret) < MIN_JWT_SECRET_LENGTH
    with pytest.raises(ValidationError):
        Settings(database_url="x", jwt_secret=secret, environment=environment)


def test_allows_long_enough_secret():
    Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET, environment="production")


@pytest.mark.parametrize("environment", ["prod", "Production", "staging", ""])
def test_rejects_unknown_environment(environment):
    # A typo must fail at startup rather than run production with dev-only
    # tooling (docs, the OTP peek endpoint) switched on.
    with pytest.raises(ValidationError):
        Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET, environment=environment)


@pytest.mark.parametrize(
    ("environment", "expected"), [("development", True), ("test", True), ("production", False)]
)
def test_exposes_dev_tooling_only_in_dev_and_test(environment, expected):
    s = Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET, environment=environment)
    assert s.exposes_dev_tooling is expected


def test_cors_allowed_origins_in_production():
    s = Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET, environment="production")
    assert s.cors_allowed_origins == ["https://sks-lotse.de", "https://www.sks-lotse.de"]


def test_cors_allowed_origins_outside_production():
    s = Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET, environment="development")
    assert s.cors_allowed_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]
