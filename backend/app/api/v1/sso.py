import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.email_address import canonicalize_email
from app.core.jwt import create_access_token, set_session_cookie
from app.core.otp import is_disposable_email
from app.models import User, UserIdentity
from app.schemas.auth import SsoProvidersRead
from app.services import sso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/sso", tags=["auth"])

# Holds provider, state and PKCE verifier between /start and /callback: signed with JWT_SECRET, so
# no server-side storage. Scoped to this router's paths and short-lived.
STATE_COOKIE_NAME = "sso_state"
STATE_COOKIE_PATH = "/api/v1/auth/sso"
STATE_TTL_MINUTES = 10


def _provider_or_404(name: str) -> sso.Provider:
    provider = sso.providers().get(name)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return provider


def _login_error(code: str) -> RedirectResponse:
    # Redirect to the login page, never a 401: the frontend treats any 401 as a dead session.
    response = RedirectResponse(f"{settings.frontend_base_url}/login?{urlencode({'sso_error': code})}")
    response.delete_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
    return response


def _read_state_cookie(request: Request, provider: sso.Provider, state: str | None) -> str | None:
    """The PKCE verifier if the cookie is intact, for this provider, and matches `state`."""
    token = request.cookies.get(STATE_COOKIE_NAME)
    if not token or not state:
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("p") != provider.name or payload.get("s") != state:
        return None
    return payload["v"]


def _user_for_profile(db: Session, provider: sso.Provider, profile: sso.Profile) -> User | str:
    """The account to sign in, or an error code for the login page."""
    identity = db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == provider.name, UserIdentity.subject == profile.subject
        )
    ).scalar_one_or_none()
    if identity is not None:
        return db.get(User, identity.user_id)

    if not profile.email or not profile.email_verified:
        return "no_email"
    email = canonicalize_email(profile.email)
    allowed = settings.allowed_emails_set
    if (allowed is not None and email not in allowed) or is_disposable_email(email):
        return "not_allowed"

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(email=email)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # A concurrent first login for the same email created the row — use that one.
            db.rollback()
            user = db.execute(select(User).where(User.email == email)).scalar_one()
        else:
            db.refresh(user)
    db.add(UserIdentity(user_id=user.id, provider=provider.name, subject=profile.subject))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return user


@router.get("/providers", response_model=SsoProvidersRead)
def list_providers() -> SsoProvidersRead:
    return SsoProvidersRead(providers=sorted(sso.providers()))


@router.get("/{provider}/start", include_in_schema=True)
def start(provider: str) -> RedirectResponse:
    spec = _provider_or_404(provider)
    state = sso.new_state()
    verifier = sso.new_code_verifier()
    cookie = jwt.encode(
        {
            "p": spec.name,
            "s": state,
            "v": verifier,
            "exp": datetime.now(UTC) + timedelta(minutes=STATE_TTL_MINUTES),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    response = RedirectResponse(sso.authorize_url(spec, state, verifier))
    response.set_cookie(
        STATE_COOKIE_NAME,
        cookie,
        max_age=STATE_TTL_MINUTES * 60,
        httponly=True,
        secure=settings.is_production,
        # Lax: the provider's redirect back is a top-level GET navigation, which still carries it.
        samesite="lax",
        path=STATE_COOKIE_PATH,
    )
    return response


@router.get("/{provider}/callback")
def callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    spec = _provider_or_404(provider)
    if error is not None:
        # e.g. the learner pressed "Abbrechen" at the provider.
        return _login_error("cancelled")
    verifier = _read_state_cookie(request, spec, state)
    if verifier is None or not code:
        return _login_error("failed")
    try:
        profile = sso.fetch_profile(spec, code, verifier)
    except sso.SsoError:
        logger.warning("SSO code exchange with %s failed", spec.name, exc_info=True)
        return _login_error("failed")

    result = _user_for_profile(db, spec, profile)
    if isinstance(result, str):
        return _login_error(result)

    response = RedirectResponse(f"{settings.frontend_base_url}/start")
    set_session_cookie(response, create_access_token(result.id, result.token_version))
    response.delete_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
    return response
