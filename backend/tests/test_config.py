import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import MIN_JWT_SECRET_LENGTH, Settings

_LONG_ENOUGH_SECRET = "a" * MIN_JWT_SECRET_LENGTH


@pytest.fixture(autouse=True)
def _defaults_only(monkeypatch):
    # These tests pin what Settings does with the values passed in and its own
    # defaults. A developer's backend/.env (e.g. a real ADMIN_EMAILS) or the
    # shell's environment (CI's DATABASE_URL/JWT_SECRET) would otherwise
    # override those defaults, so neither source is read here.
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    for name in Settings.model_fields:
        monkeypatch.delenv(name.upper(), raising=False)


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


def test_env_example_lists_every_setting():
    # CLAUDE.md points to .env.example as the complete list of backend env
    # vars instead of repeating it — this keeps that claim true.
    env_example = (Path(__file__).resolve().parent.parent / ".env.example").read_text()
    listed = set(re.findall(r"^#?\s*([A-Z0-9_]+)=", env_example, re.MULTILINE))
    assert {name.upper() for name in Settings.model_fields} <= listed


def test_admin_emails_set_defaults_to_empty_set_not_none():
    # Fail-closed: unlike allowed_emails_set, an unset ADMIN_EMAILS must
    # never be read as "open to everyone" — it must deny every caller.
    s = Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET)
    assert s.admin_emails_set == set()


def test_admin_emails_set_parses_comma_separated_list_case_insensitively():
    s = Settings(
        database_url="x", jwt_secret=_LONG_ENOUGH_SECRET, admin_emails="Admin@Example.com, other@example.com"
    )
    assert s.admin_emails_set == {"admin@example.com", "other@example.com"}


def test_render_flag_read_from_render_env_var(monkeypatch):
    # Render sets RENDER=true on every service; that's what enables trusting
    # its proxy's client-IP headers (app/main.py).
    monkeypatch.setenv("RENDER", "true")
    assert Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET).render is True
    monkeypatch.delenv("RENDER")
    assert Settings(database_url="x", jwt_secret=_LONG_ENOUGH_SECRET).render is False
