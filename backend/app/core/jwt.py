from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, Request, Response, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.totp import mfa_is_fresh
from app.models import User

# Shared with app/api/v1/auth.py, which sets/clears this cookie on
# verify/logout (see ADR-0012) — kept here since this module is where the
# corresponding read side lives.
SESSION_COOKIE_NAME = "access_token"
# The 403 detail of an admin route whose session still needs its TOTP check (require_admin).
MFA_REQUIRED = "mfa_required"

_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, token_version: int, mfa_at: int | None = None) -> str:
    """A session token; `mfa_at` (unix time of a TOTP check, ADR-0047) opens the admin area."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expires_minutes)
    payload: dict[str, object] = {"sub": str(user_id), "tv": token_version, "iat": now, "exp": expires_at}
    if mfa_at is not None:
        payload["mfa"] = mfa_at
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def issue_session(response: Response, user: User, mfa_at: int | None = None) -> str:
    """Mint a session token for `user` and set it as the session cookie; returns the token."""
    access_token = create_access_token(user.id, user.token_version, mfa_at)
    # The browser frontend never reads this token directly (see ADR-0012) —
    # it's set as an httpOnly cookie here, in addition to the response body,
    # which stays populated for Postman/the integration-test suite/any
    # future non-browser client (Bearer fallback, see get_session_claims).
    response.set_cookie(
        SESSION_COOKIE_NAME,
        access_token,
        max_age=settings.jwt_access_token_expires_minutes * 60,
        httponly=True,
        # Secure cookies are dropped by browsers over plain http://, which
        # local dev uses — only require it once actually deployed.
        secure=settings.is_production,
        samesite="lax",
        path="/",
    )
    return access_token


def get_session_claims(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> dict:
    """The verified claims of the caller's session token; get_current_user checks the user behind it."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    # Cookie first (the browser frontend, per ADR-0012), falling back to
    # Authorization: Bearer (Postman, the integration-test suite, any future
    # non-browser client).
    token = request.cookies.get(SESSION_COOKIE_NAME) or (credentials.credentials if credentials else None)
    if token is None:
        raise unauthorized
    try:
        # PyJWT checks `exp` only when present — requiring it means a token signed without one
        # (a bug elsewhere, a hand-made test token) can never become a session that never expires.
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub", "tv"]}
        )
        payload["sub"] = int(payload["sub"])
        payload["tv"] = int(payload["tv"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise unauthorized from exc
    return payload


def get_current_user(claims: dict = Depends(get_session_claims), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = db.get(User, claims["sub"])
    if user is None:
        raise unauthorized
    # Logout increments the user's token_version, so any token minted with an
    # older version — including the one just used to log out — is rejected.
    # No separate token blacklist needed: this invalidates every previously
    # issued token for the user in one step.
    if claims["tv"] != user.token_version:
        raise unauthorized
    return user


def require_admin_identity(current_user: User = Depends(get_current_user)) -> User:
    """An ADMIN_EMAILS account, second factor or not — only for the 2FA routes themselves."""
    if current_user.email not in settings.admin_emails_set:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_admin(
    claims: dict = Depends(get_session_claims), admin: User = Depends(require_admin_identity)
) -> User:
    """An admin whose session passed a TOTP check recently (ADR-0047).

    403, not 401: the frontend treats any 401 as a dead session and logs out, but the session is
    fine — it just needs the step-up (MFA_REQUIRED tells the admin area to ask for a code).
    """
    if not mfa_is_fresh(claims.get("mfa"), datetime.now(UTC)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MFA_REQUIRED)
    return admin
