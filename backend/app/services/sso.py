"""SSO with Google and Facebook (ADR-0034): server-side OAuth2 authorization-code flow.

The browser is sent to the provider, comes back to /auth/sso/{provider}/callback with a one-time
`code`, and this module trades it for the learner's provider id and email over TLS. The provider's
tokens are never stored; only (provider, subject) is (`UserIdentity`).
"""

import base64
import hashlib
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import settings

HTTP_TIMEOUT_SECONDS = 10.0


class SsoError(Exception):
    """The provider exchange failed (bad code, network, malformed answer)."""


@dataclass(frozen=True)
class Provider:
    name: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: str
    client_id: str
    client_secret: str
    # Google supports PKCE for confidential clients, Facebook's docs don't promise it — there the
    # signed state cookie is the CSRF protection.
    pkce: bool


@dataclass(frozen=True)
class Profile:
    subject: str
    email: str | None
    email_verified: bool


def providers() -> dict[str, Provider]:
    """The configured providers only: an empty client id or secret switches one off."""
    candidates = [
        Provider(
            name="google",
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",  # noqa: S106 — public URL, not a secret
            userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
            scope="openid email",
            client_id=settings.google_oauth_client_id,
            client_secret=settings.google_oauth_client_secret,
            pkce=True,
        ),
        Provider(
            name="facebook",
            authorize_url="https://www.facebook.com/v19.0/dialog/oauth",
            token_url="https://graph.facebook.com/v19.0/oauth/access_token",  # noqa: S106 — public URL
            userinfo_url="https://graph.facebook.com/v19.0/me",
            scope="email",
            client_id=settings.facebook_oauth_client_id,
            client_secret=settings.facebook_oauth_client_secret,
            pkce=False,
        ),
    ]
    return {p.name: p for p in candidates if p.client_id and p.client_secret}


def redirect_uri(provider: Provider) -> str:
    return f"{settings.api_base_url}/api/v1/auth/sso/{provider.name}/callback"


def new_state() -> str:
    return secrets.token_urlsafe(32)


def new_code_verifier() -> str:
    return secrets.token_urlsafe(64)


def _code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def authorize_url(provider: Provider, state: str, code_verifier: str) -> str:
    params = {
        "client_id": provider.client_id,
        "redirect_uri": redirect_uri(provider),
        "response_type": "code",
        "scope": provider.scope,
        "state": state,
    }
    if provider.pkce:
        params["code_challenge"] = _code_challenge(code_verifier)
        params["code_challenge_method"] = "S256"
    return f"{provider.authorize_url}?{urlencode(params)}"


def fetch_profile(provider: Provider, code: str, code_verifier: str) -> Profile:
    """Trade the one-time `code` for the learner's provider id and email."""
    token_data = {
        "client_id": provider.client_id,
        "client_secret": provider.client_secret,
        "redirect_uri": redirect_uri(provider),
        "code": code,
        "grant_type": "authorization_code",
    }
    if provider.pkce:
        token_data["code_verifier"] = code_verifier
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT_SECONDS) as client:
            token_response = client.post(provider.token_url, data=token_data)
            token_response.raise_for_status()
            access_token = token_response.json()["access_token"]
            if provider.name == "google":
                info_response = client.get(
                    provider.userinfo_url, headers={"Authorization": f"Bearer {access_token}"}
                )
            else:
                info_response = client.get(
                    provider.userinfo_url, params={"fields": "id,email", "access_token": access_token}
                )
            info_response.raise_for_status()
            info = info_response.json()
        if provider.name == "google":
            return Profile(
                subject=str(info["sub"]),
                email=info.get("email"),
                email_verified=info.get("email_verified") is True,
            )
        # Facebook only returns an address it has confirmed, and omits it otherwise.
        return Profile(
            subject=str(info["id"]), email=info.get("email"), email_verified=bool(info.get("email"))
        )
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise SsoError(str(exc)) from exc
