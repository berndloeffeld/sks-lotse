import pytest

from app.core.config import _MIN_PRODUCTION_JWT_SECRET_LENGTH, Settings, _reject_insecure_production_secret

_LONG_ENOUGH_SECRET = "a" * _MIN_PRODUCTION_JWT_SECRET_LENGTH


def test_rejects_empty_secret_in_production():
    s = Settings(database_url="x", jwt_secret="", environment="production")
    with pytest.raises(RuntimeError):
        _reject_insecure_production_secret(s)


@pytest.mark.parametrize("secret", ["change-me", "test-secret-not-for-production"])
def test_rejects_short_placeholder_secrets_in_production(secret):
    # Length-based, not an exact-string blocklist — this is deliberately not
    # a string this project happens to use elsewhere (e.g. in CI), to prove
    # the check generalizes rather than only catching known values.
    assert len(secret) < _MIN_PRODUCTION_JWT_SECRET_LENGTH
    s = Settings(database_url="x", jwt_secret=secret, environment="production")
    with pytest.raises(RuntimeError):
        _reject_insecure_production_secret(s)


def test_allows_long_enough_secret_in_production():
    s = Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET, environment="production")
    _reject_insecure_production_secret(s)


def test_allows_short_secret_outside_production():
    s = Settings(database_url="x", jwt_secret="change-me", environment="development")
    _reject_insecure_production_secret(s)
