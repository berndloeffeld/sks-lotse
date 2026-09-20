from urllib.parse import parse_qs, urlparse

import pytest

from app.core.config import settings
from app.core.jwt import SESSION_COOKIE_NAME
from app.models import User, UserIdentity
from app.services import sso


@pytest.fixture(autouse=True)
def _providers(monkeypatch):
    monkeypatch.setattr(settings, "google_oauth_client_id", "g-id")
    monkeypatch.setattr(settings, "google_oauth_client_secret", "g-secret")
    monkeypatch.setattr(settings, "facebook_oauth_client_id", "f-id")
    monkeypatch.setattr(settings, "facebook_oauth_client_secret", "f-secret")


def _start(client, provider="google"):
    response = client.get(f"/api/v1/auth/sso/{provider}/start", follow_redirects=False)
    assert response.status_code == 307
    query = parse_qs(urlparse(response.headers["location"]).query)
    return response, query["state"][0]


def _fake_profile(monkeypatch, profile):
    monkeypatch.setattr("app.api.v1.sso.sso.fetch_profile", lambda provider, code, verifier: profile)


def _callback(client, state, provider="google", **params):
    return client.get(
        f"/api/v1/auth/sso/{provider}/callback",
        params={"code": "abc", "state": state, **params},
        follow_redirects=False,
    )


def test_providers_lists_only_configured(client, monkeypatch):
    assert client.get("/api/v1/auth/sso/providers").json() == {"providers": ["facebook", "google"]}
    monkeypatch.setattr(settings, "facebook_oauth_client_secret", "")
    assert client.get("/api/v1/auth/sso/providers").json() == {"providers": ["google"]}


def test_start_redirects_to_provider_with_state_and_pkce(client):
    response, state = _start(client)
    location = urlparse(response.headers["location"])
    query = parse_qs(location.query)
    assert location.netloc == "accounts.google.com"
    assert query["client_id"] == ["g-id"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["redirect_uri"] == [f"{settings.api_base_url}/api/v1/auth/sso/google/callback"]
    assert "sso_state" in response.headers["set-cookie"] and "HttpOnly" in response.headers["set-cookie"]
    assert state


def test_start_facebook_has_no_pkce(client):
    response, _ = _start(client, "facebook")
    assert "code_challenge" not in response.headers["location"]


@pytest.mark.parametrize("path", ["start", "callback"])
def test_unknown_or_unconfigured_provider_is_404(client, monkeypatch, path):
    assert client.get(f"/api/v1/auth/sso/x/{path}", follow_redirects=False).status_code == 404
    monkeypatch.setattr(settings, "google_oauth_client_id", "")
    assert client.get(f"/api/v1/auth/sso/google/{path}", follow_redirects=False).status_code == 404


def test_callback_creates_account_and_session(client, db_session, monkeypatch):
    _, state = _start(client)
    _fake_profile(
        monkeypatch, sso.Profile(subject="sub-1", email="New.Learner@example.com", email_verified=True)
    )
    response = _callback(client, state)
    assert response.status_code == 307
    assert response.headers["location"] == f"{settings.frontend_base_url}/start"
    assert SESSION_COOKIE_NAME in response.cookies
    user = db_session.query(User).one()
    assert user.email == "new.learner@example.com"
    identity = db_session.query(UserIdentity).one()
    assert (identity.provider, identity.subject, identity.user_id) == ("google", "sub-1", user.id)
    assert client.get("/api/v1/auth/me").json()["email"] == "new.learner@example.com"


def test_callback_links_existing_email_account(client, db_session, monkeypatch):
    existing = User(email="learner@example.com")
    db_session.add(existing)
    db_session.commit()
    _, state = _start(client, "facebook")
    _fake_profile(monkeypatch, sso.Profile(subject="fb-1", email="learner@example.com", email_verified=True))
    response = _callback(client, state, "facebook")
    assert response.headers["location"].endswith("/start")
    assert db_session.query(User).count() == 1
    assert db_session.query(UserIdentity).one().user_id == existing.id


def test_callback_known_identity_signs_in_even_if_email_changed(client, db_session, monkeypatch):
    user = User(email="old@example.com")
    db_session.add(user)
    db_session.flush()
    db_session.add(UserIdentity(user_id=user.id, provider="google", subject="sub-9"))
    db_session.commit()
    _, state = _start(client)
    _fake_profile(monkeypatch, sso.Profile(subject="sub-9", email="other@example.com", email_verified=True))
    response = _callback(client, state)
    assert response.headers["location"].endswith("/start")
    assert db_session.query(User).count() == 1


@pytest.mark.parametrize(
    "profile",
    [
        sso.Profile(subject="s", email=None, email_verified=False),
        sso.Profile(subject="s", email="a@example.com", email_verified=False),
    ],
)
def test_callback_without_verified_email_is_rejected(client, db_session, monkeypatch, profile):
    _, state = _start(client)
    _fake_profile(monkeypatch, profile)
    response = _callback(client, state)
    assert response.headers["location"].endswith("/login?sso_error=no_email")
    assert db_session.query(User).count() == 0
    assert SESSION_COOKIE_NAME not in response.cookies


def test_callback_respects_allowlist(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "allowed_emails", "someone@example.com")
    _, state = _start(client)
    _fake_profile(monkeypatch, sso.Profile(subject="s", email="a@example.com", email_verified=True))
    assert _callback(client, state).headers["location"].endswith("sso_error=not_allowed")
    assert db_session.query(User).count() == 0


def test_callback_rejects_disposable_email(client, db_session, monkeypatch):
    monkeypatch.setattr("app.api.v1.sso.is_disposable_email", lambda email: True)
    _, state = _start(client)
    _fake_profile(monkeypatch, sso.Profile(subject="s", email="a@example.com", email_verified=True))
    assert _callback(client, state).headers["location"].endswith("sso_error=not_allowed")


def test_callback_provider_error_is_cancelled(client):
    _, state = _start(client)
    response = client.get(
        "/api/v1/auth/sso/google/callback",
        params={"error": "access_denied", "state": state},
        follow_redirects=False,
    )
    assert response.headers["location"].endswith("/login?sso_error=cancelled")


def test_callback_state_mismatch_or_missing_cookie_fails(client, monkeypatch):
    _fake_profile(monkeypatch, sso.Profile(subject="s", email="a@example.com", email_verified=True))
    assert _callback(client, "no-cookie-yet").headers["location"].endswith("sso_error=failed")
    _start(client)
    assert _callback(client, "wrong-state").headers["location"].endswith("sso_error=failed")


def test_callback_cookie_from_other_provider_fails(client, monkeypatch):
    _, state = _start(client, "google")
    _fake_profile(monkeypatch, sso.Profile(subject="s", email="a@example.com", email_verified=True))
    assert _callback(client, state, "facebook").headers["location"].endswith("sso_error=failed")


def test_callback_tampered_cookie_fails(client):
    client.cookies.set("sso_state", "not-a-jwt", path="/api/v1/auth/sso")
    assert _callback(client, "x").headers["location"].endswith("sso_error=failed")


def test_callback_missing_code_fails(client):
    _, state = _start(client)
    response = client.get("/api/v1/auth/sso/google/callback", params={"state": state}, follow_redirects=False)
    assert response.headers["location"].endswith("sso_error=failed")


def test_callback_exchange_failure_is_reported(client, monkeypatch):
    _, state = _start(client)

    def boom(provider, code, verifier):
        raise sso.SsoError("nope")

    monkeypatch.setattr("app.api.v1.sso.sso.fetch_profile", boom)
    assert _callback(client, state).headers["location"].endswith("sso_error=failed")


def test_deleting_the_account_removes_identities(client, db_session, monkeypatch):
    _, state = _start(client)
    _fake_profile(monkeypatch, sso.Profile(subject="sub-1", email="gone@example.com", email_verified=True))
    _callback(client, state)
    assert client.delete("/api/v1/auth/me").status_code == 204
    assert db_session.query(UserIdentity).count() == 0
