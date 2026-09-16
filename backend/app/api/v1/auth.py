import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import create_access_token, get_current_user
from app.core.otp import (
    OTP_MAX_ATTEMPTS,
    OTP_MAX_REQUESTS_PER_WINDOW,
    OTP_REQUEST_WINDOW_MINUTES,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_MINUTES,
    generate_code,
    hash_code,
    is_disposable_email,
    verify_code,
)
from app.models import OtpCode, User
from app.schemas.auth import OtpRequestAccepted, OtpRequestCreate, OtpVerifyRequest, TokenRead, UserRead
from app.services import email as email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID_CODE = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")


def _latest_otp_code(db: Session, email: str) -> OtpCode | None:
    # Order by id, not created_at: created_at's DB-side timestamp resolution
    # (e.g. 1s on SQLite) can tie for two requests issued in quick succession,
    # while id is always monotonically increasing.
    stmt = select(OtpCode).where(OtpCode.email == email).order_by(OtpCode.id.desc()).limit(1)
    return db.execute(stmt).scalars().first()


def _as_utc(dt: datetime) -> datetime:
    # SQLite (used in tests) drops tzinfo on round-trip even for DateTime(timezone=True)
    # columns; every timestamp written by this module is UTC, so treat naive as UTC.
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


@router.post("/otp/request", response_model=OtpRequestAccepted, status_code=status.HTTP_202_ACCEPTED)
def request_otp(payload: OtpRequestCreate, db: Session = Depends(get_db)):
    allowed_emails = settings.allowed_emails_set
    if allowed_emails is not None and payload.email.lower() not in allowed_emails:
        # Same generic response as every other throttled/rejected case below —
        # doesn't leak whether this email is on the allowlist.
        return OtpRequestAccepted()

    if is_disposable_email(payload.email):
        return OtpRequestAccepted()

    now = datetime.now(UTC)

    window_start = now - timedelta(minutes=OTP_REQUEST_WINDOW_MINUTES)
    recent_requests = db.execute(
        select(func.count())
        .select_from(OtpCode)
        .where(OtpCode.email == payload.email, OtpCode.created_at >= window_start)
    ).scalar_one()
    if recent_requests >= OTP_MAX_REQUESTS_PER_WINDOW:
        return OtpRequestAccepted()

    latest = _latest_otp_code(db, payload.email)
    if latest is not None and (now - _as_utc(latest.created_at)) < timedelta(
        seconds=OTP_RESEND_COOLDOWN_SECONDS
    ):
        return OtpRequestAccepted()

    code = generate_code()
    otp = OtpCode(
        email=payload.email,
        code_hash=hash_code(code),
        expires_at=now + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp)
    db.commit()

    try:
        email_service.send_otp_email(payload.email, code)
    except Exception:
        logger.exception("Failed to send OTP email to %s", payload.email)

    return OtpRequestAccepted()


@router.post("/otp/verify", response_model=TokenRead)
def verify_otp(payload: OtpVerifyRequest, db: Session = Depends(get_db)):
    otp = _latest_otp_code(db, payload.email)
    if otp is None:
        raise _INVALID_CODE

    now = datetime.now(UTC)
    valid = otp.consumed_at is None and _as_utc(otp.expires_at) > now and otp.attempts < OTP_MAX_ATTEMPTS
    if valid:
        valid = verify_code(payload.code, otp.code_hash)

    if not valid:
        otp.attempts += 1
        db.commit()
        raise _INVALID_CODE

    otp.consumed_at = now
    db.commit()

    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if user is None:
        user = User(email=payload.email)
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(user.id)
    return TokenRead(access_token=access_token)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
