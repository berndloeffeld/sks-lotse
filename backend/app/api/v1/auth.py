import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core import cache
from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import create_access_token, get_current_user
from app.core.otp import (
    OTP_CLEANUP_MIN_INTERVAL_SECONDS,
    OTP_CODE_RETENTION_HOURS,
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
from app.schemas.auth import (
    OtpDevPeekRead,
    OtpRequestAccepted,
    OtpRequestCreate,
    OtpVerifyRequest,
    TokenRead,
    UserRead,
)
from app.services import email as email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID_CODE = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")
_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND)


def _dev_otp_codes(app) -> dict[str, str]:
    # Plaintext codes only ever exist here — otp_codes.code_hash (see
    # hash_code) is one-way, by design. Gated to non-production and never
    # populated at all in production (see request_otp), so this doesn't add
    # a standing plaintext-code store to the deployed app.
    if not hasattr(app.state, "dev_otp_codes"):
        app.state.dev_otp_codes = {}
    return app.state.dev_otp_codes


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


def _cleanup_expired_otp_codes(db: Session, now: datetime) -> None:
    # otp_codes is pure transient data (see docs/adr/0010) — nothing outside
    # the OTP flow itself reads a code once it's past its retention window.
    # Runs as a FastAPI background task, gated by cache.throttle (see
    # request_otp) so it fires on a bounded cadence rather than once per
    # request — a separate job/schedule would work too, but this needs no
    # new infrastructure, and the DELETE doesn't add latency to the response
    # the caller is waiting on either way; see ADR-0010. Commits on its own
    # since it no longer shares a transaction with the request that
    # scheduled it — that request has already returned its response by the
    # time this runs.
    cutoff = now - timedelta(hours=OTP_CODE_RETENTION_HOURS)
    # synchronize_session=False: nothing holds a reference to an
    # about-to-be-deleted row, so there's no session-local ORM state that
    # needs to stay in sync — and evaluating the WHERE clause against the
    # session's identity map (the default "evaluate" strategy) chokes on
    # SQLite's naive datetimes (see `_as_utc` above) vs this tz-aware cutoff.
    stmt = delete(OtpCode).where(OtpCode.expires_at < cutoff).execution_options(synchronize_session=False)
    db.execute(stmt)
    db.commit()


@router.post("/otp/request", response_model=OtpRequestAccepted, status_code=status.HTTP_202_ACCEPTED)
def request_otp(
    payload: OtpRequestCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
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

    if cache.throttle(request.app, "otp_cleanup:sweep", OTP_CLEANUP_MIN_INTERVAL_SECONDS):
        background_tasks.add_task(_cleanup_expired_otp_codes, db, now)

    code = generate_code()
    otp = OtpCode(
        email=payload.email,
        code_hash=hash_code(code),
        expires_at=now + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp)
    db.commit()

    if not settings.is_production:
        _dev_otp_codes(request.app)[payload.email.lower()] = code

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

    access_token = create_access_token(user.id, user.token_version)
    return TokenRead(access_token=access_token)


@router.get("/otp/_dev-peek", response_model=OtpDevPeekRead, include_in_schema=False)
def dev_peek_otp_code(email: str, request: Request):
    # Lets an external integration-test run (Postman/Newman against a real
    # local server) complete the OTP round-trip without a real inbox — pytest
    # gets this for free by monkeypatching send_otp_email in-process, which
    # an external HTTP client can't do. Excluded from the OpenAPI schema (so
    # it never lands in the generated API-reference Postman collection) and
    # 404s outright in production, same treatment as the docs endpoints (see
    # _docs_kwargs in app/main.py). See ADR-0011.
    if settings.is_production:
        raise _NOT_FOUND
    code = _dev_otp_codes(request.app).get(email.lower())
    if code is None:
        raise _NOT_FOUND
    return OtpDevPeekRead(code=code)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # No token blacklist: bumping the version invalidates every access token
    # issued for this user in one step (see get_current_user in
    # app/core/jwt.py), including the one used to call this endpoint.
    current_user.token_version += 1
    db.commit()
