from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import User

# Shared with app/api/v1/auth.py, which sets/clears this cookie on
# verify/logout (see ADR-0012) — kept here since this module is where the
# corresponding read side lives.
SESSION_COOKIE_NAME = "access_token"

_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, token_version: int) -> str:
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expires_minutes)
    payload = {"sub": str(user_id), "tv": token_version, "iat": now, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
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
        user_id = int(payload["sub"])
        token_version = int(payload["tv"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise unauthorized from exc

    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    # Logout increments the user's token_version, so any token minted with an
    # older version — including the one just used to log out — is rejected.
    # No separate token blacklist needed: this invalidates every previously
    # issued token for the user in one step.
    if token_version != user.token_version:
        raise unauthorized
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.email not in settings.admin_emails_set:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
