import pytest

from app.core.config import Settings, _reject_insecure_production_secret


def test_rejects_empty_secret_in_production():
    s = Settings(database_url="x", jwt_secret="", environment="production")
    with pytest.raises(RuntimeError):
        _reject_insecure_production_secret(s)


def test_rejects_placeholder_secret_in_production():
    s = Settings(database_url="x", jwt_secret="change-me", environment="production")
    with pytest.raises(RuntimeError):
        _reject_insecure_production_secret(s)


def test_allows_real_secret_in_production():
    s = Settings(database_url="x", jwt_secret="a-real-random-value", environment="production")
    _reject_insecure_production_secret(s)


def test_allows_placeholder_secret_outside_production():
    s = Settings(database_url="x", jwt_secret="change-me", environment="development")
    _reject_insecure_production_secret(s)
