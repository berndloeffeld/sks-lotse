import httpx
import pytest

from app.core.config import settings
from app.services import sso


@pytest.fixture(autouse=True)
def _providers(monkeypatch):
    monkeypatch.setattr(settings, "google_oauth_client_id", "g-id")
    monkeypatch.setattr(settings, "google_oauth_client_secret", "g-secret")
    monkeypatch.setattr(settings, "facebook_oauth_client_id", "f-id")
    monkeypatch.setattr(settings, "facebook_oauth_client_secret", "f-secret")


def _mock_provider(monkeypatch, handler):
    real_client = httpx.Client
    monkeypatch.setattr(
        "app.services.sso.httpx.Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )


def test_google_profile(monkeypatch):
    seen = {}

    def handler(request):
        if request.url.host == "oauth2.googleapis.com":
            seen["token_form"] = request.content.decode()
            return httpx.Response(200, json={"access_token": "tok"})
        seen["auth"] = request.headers["authorization"]
        return httpx.Response(200, json={"sub": "123", "email": "a@example.com", "email_verified": True})

    _mock_provider(monkeypatch, handler)
    profile = sso.fetch_profile(sso.providers()["google"], "the-code", "verifier")
    assert profile == sso.Profile(subject="123", email="a@example.com", email_verified=True)
    assert "code_verifier=verifier" in seen["token_form"] and "code=the-code" in seen["token_form"]
    assert seen["auth"] == "Bearer tok"


def test_google_unverified_email(monkeypatch):
    def handler(request):
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "tok"})
        return httpx.Response(200, json={"sub": "1", "email": "a@example.com"})

    _mock_provider(monkeypatch, handler)
    assert not sso.fetch_profile(sso.providers()["google"], "c", "v").email_verified


def test_facebook_profile_with_and_without_email(monkeypatch):
    payloads = [{"id": "9", "email": "a@example.com"}, {"id": "9"}]

    def handler(request):
        if request.url.path.endswith("oauth/access_token"):
            assert "code_verifier" not in request.content.decode()
            return httpx.Response(200, json={"access_token": "tok"})
        assert request.url.params["access_token"] == "tok"
        return httpx.Response(200, json=payloads.pop(0))

    _mock_provider(monkeypatch, handler)
    facebook = sso.providers()["facebook"]
    assert sso.fetch_profile(facebook, "c", "v") == sso.Profile("9", "a@example.com", True)
    assert sso.fetch_profile(facebook, "c", "v") == sso.Profile("9", None, False)


@pytest.mark.parametrize(
    "handler",
    [
        lambda request: httpx.Response(400, json={"error": "invalid_grant"}),
        lambda request: httpx.Response(200, json={"no": "token"}),
        lambda request: httpx.Response(200, text="not json"),
    ],
)
def test_exchange_failures_raise_sso_error(monkeypatch, handler):
    _mock_provider(monkeypatch, handler)
    with pytest.raises(sso.SsoError):
        sso.fetch_profile(sso.providers()["google"], "c", "v")
