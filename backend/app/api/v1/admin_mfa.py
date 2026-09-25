import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import get_session_claims, issue_session, require_admin_identity
from app.core.rate_limit import enforce_limit
from app.core.totp import mfa_is_fresh
from app.models import User
from app.schemas.admin import AdminMfaCode, AdminMfaEnrolment, AdminMfaStatus
from app.schemas.auth import TokenRead
from app.services import admin_mfa

logger = logging.getLogger(__name__)

# The admin area's second factor (ADR-0047). Gated on the admin allowlist only — these routes are
# how an admin session gets the TOTP check every other /admin route requires (require_admin).
router = APIRouter(prefix="/admin/mfa", tags=["admin"], dependencies=[Depends(require_admin_identity)])

# 400, not 401: the caller's session is valid, and the frontend logs out on any 401
# (same reasoning as _INVALID_EMAIL_CHANGE_CODE in app/api/v1/auth.py).
_INVALID_CODE = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code")


@router.get("/status", response_model=AdminMfaStatus)
def get_status(
    claims: dict = Depends(get_session_claims), admin: User = Depends(require_admin_identity)
) -> AdminMfaStatus:
    enrolled = admin_mfa.is_enrolled(admin)
    return AdminMfaStatus(
        enrolled=enrolled, verified=enrolled and mfa_is_fresh(claims.get("mfa"), datetime.now(UTC))
    )


@router.post("/enrol", response_model=AdminMfaEnrolment)
def start_enrolment(
    admin: User = Depends(require_admin_identity), db: Session = Depends(get_db)
) -> AdminMfaEnrolment:
    """A new TOTP secret for the authenticator app; active once /verify accepts a code for it."""
    # Once active, only the reset script (docs/RUNBOOK.md) can replace it — otherwise a stolen
    # email session could enrol its own authenticator and skip the second factor.
    if admin_mfa.is_enrolled(admin):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="2FA is already enabled")
    return admin_mfa.start_enrolment(db, admin)


@router.post("/verify", response_model=TokenRead)
def verify(
    payload: AdminMfaCode,
    request: Request,
    response: Response,
    admin: User = Depends(require_admin_identity),
    db: Session = Depends(get_db),
) -> TokenRead:
    """Check a TOTP code — the first one completes the enrolment — and re-issue the session with it."""
    enforce_limit(
        request.app,
        "admin_mfa_verify:user",
        str(admin.id),
        settings.admin_mfa_max_attempts_per_window,
        settings.admin_mfa_window_seconds,
        "Too many attempts",
        log_message=f"admin 2fa: too many attempts admin={admin.id}",
    )
    was_enrolled = admin_mfa.is_enrolled(admin)
    now = datetime.now(UTC)
    if not admin_mfa.confirm_code(db, admin, payload.code, now):
        raise _INVALID_CODE
    if not was_enrolled:
        logger.info("admin 2fa enabled: admin=%s", admin.id)
    return TokenRead(access_token=issue_session(response, admin, mfa_at=int(now.timestamp())))
