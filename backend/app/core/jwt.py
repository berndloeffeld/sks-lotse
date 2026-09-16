from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import User

_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, token_version: int) -> str:
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_token_expires_minutes)
    payload = {"sub": str(user_id), "tv": token_version, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if credentials is None:
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
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
