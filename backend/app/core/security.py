"""Temporary pre-launch access gate — not the planned JWT auth system.

Restricts the API to whoever holds ACCESS_GATE_KEY while the app is
deployed but not yet publicly launched. Remove this once the real
auth system exists or the app is meant to be public.
"""

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import settings

_api_key_header = APIKeyHeader(name="X-Access-Key", auto_error=False)


def require_access_key(key: str | None = Security(_api_key_header)):
    if not settings.access_gate_key:
        return  # gate disabled — e.g. local dev, or not yet configured
    if key != settings.access_gate_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing access key")
