import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import cache
from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import SESSION_COOKIE_NAME, create_access_token, get_current_user
from app.core.otp import generate_code, hash_code, is_disposable_email, verify_code
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
    # hash_code) is one-way, by design. Gated to settings.exposes_dev_tooling
    # and never populated at all outside it (see request_otp), so this doesn't add
    # a standing plaintext-code store to the deployed app.
    if not hasattr(app.state, "dev_otp_codes"):
        app.state.dev_otp_codes = {}
    return app.state.dev_otp_codes


def _latest_otp_code(db: Session, email: str, for_update: bool = False) -> OtpCode | None:
    # Order by id, not created_at: created_at's DB-side timestamp resolution
    # (e.g. 1s on SQLite) can tie for two requests issued in quick succession,
    # while id is always monotonically increasing.
    stmt = select(OtpCode).where(OtpCode.email == email).order_by(OtpCode.id.desc()).limit(1)
    if for_update:
        # Row lock until the caller commits, so concurrent verify attempts
        # serialize on the attempts counter instead of each reading the same
        # value and collectively exceeding otp_max_attempts. No-op on SQLite.
        stmt = stmt.with_for_update()
    return db.execute(stmt).scalars().first()


def _mask_email(email: str) -> str:
    # Enough to correlate a delivery failure in the logs, without writing a
    # full address (personal data) into them.
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


def _send_otp_email(email: str, code: str) -> None:
    # Runs as a background task: keeps Resend's latency out of the response,
    # which also narrows the timing difference between a real send and the
    # silent no-op paths in request_otp (allowlist, cooldown, ...).
    try:
        email_service.send_otp_email(email, code)
    except Exception:
        logger.exception("Failed to send OTP email to %s", _mask_email(email))


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
    cutoff = now - timedelta(hours=settings.otp_code_retention_hours)
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
    if allowed_emails is not None and payload.email not in allowed_emails:
        # Same generic response as every other throttled/rejected case below —
        # doesn't leak whether this email is on the allowlist.
        return OtpRequestAccepted()

    if is_disposable_email(payload.email):
        return OtpRequestAccepted()

    now = datetime.now(UTC)

    window_start = now - timedelta(minutes=settings.otp_request_window_minutes)
    recent_requests = db.execute(
        select(func.count())
        .select_from(OtpCode)
        .where(OtpCode.email == payload.email, OtpCode.created_at >= window_start)
    ).scalar_one()
    if recent_requests >= settings.otp_max_requests_per_window:
        return OtpRequestAccepted()

    latest = _latest_otp_code(db, payload.email)
    if latest is not None and (now - _as_utc(latest.created_at)) < timedelta(
        seconds=settings.otp_resend_cooldown_seconds
    ):
        return OtpRequestAccepted()

    if cache.throttle(request.app, "otp_cleanup:sweep", settings.otp_cleanup_min_interval_seconds):
        background_tasks.add_task(_cleanup_expired_otp_codes, db, now)

    code = generate_code()
    otp = OtpCode(
        email=payload.email,
        code_hash=hash_code(code),
        expires_at=now + timedelta(minutes=settings.otp_ttl_minutes),
    )
    db.add(otp)
    db.commit()

    if settings.exposes_dev_tooling:
        _dev_otp_codes(request.app)[payload.email] = code

    background_tasks.add_task(_send_otp_email, payload.email, code)

    return OtpRequestAccepted()


@router.post("/otp/verify", response_model=TokenRead)
def verify_otp(payload: OtpVerifyRequest, response: Response, db: Session = Depends(get_db)):
    otp = _latest_otp_code(db, payload.email, for_update=True)
    if otp is None:
        raise _INVALID_CODE

    now = datetime.now(UTC)
    not_consumed_or_expired = otp.consumed_at is None and _as_utc(otp.expires_at) > now
    valid = not_consumed_or_expired and otp.attempts < settings.otp_max_attempts
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
        try:
            db.commit()
        except IntegrityError:
            # A concurrent first login for the same email created the row
            # between our lookup and this insert — use that one.
            db.rollback()
            user = db.execute(select(User).where(User.email == payload.email)).scalar_one()
        else:
            db.refresh(user)

    access_token = create_access_token(user.id, user.token_version)
    # The browser frontend never reads this token directly (see ADR-0012) —
    # it's set as an httpOnly cookie here, in addition to the response body,
    # which stays populated for Postman/the integration-test suite/any
    # future non-browser client (Bearer fallback, see get_current_user).
    response.set_cookie(
        SESSION_COOKIE_NAME,
        access_token,
        max_age=settings.jwt_access_token_expires_minutes * 60,
        httponly=True,
        # SameSite=None because the frontend (sks-lotse.de) and this API
        # (sks-lotse-backend.onrender.com) ended up on genuinely different
        # registrable domains, not the same-site subdomain split ADR-0012
        # originally assumed — see ADR-0016 for why (a Render account-wide
        # custom-domain cap made the subdomain split impractical) and for the
        # CSRF reasoning this requires re-examining. Secure is mandatory
        # here, not just in production: browsers reject SameSite=None
        # cookies outright without it — and modern browsers treat
        # http://localhost as a secure context, so local dev still works.
        secure=True,
        samesite="none",
        path="/",
    )
    return TokenRead(access_token=access_token)


@router.get("/otp/_dev-peek", response_model=OtpDevPeekRead, include_in_schema=False)
def dev_peek_otp_code(email: str, request: Request):
    # Lets an external integration-test run (Postman/Newman against a real
    # local server) complete the OTP round-trip without a real inbox — pytest
    # gets this for free by monkeypatching send_otp_email in-process, which
    # an external HTTP client can't do. Excluded from the OpenAPI schema (so
    # it never lands in the generated API-reference Postman collection) and
    # 404s outright unless settings.exposes_dev_tooling, same gate as the docs
    # endpoints (see _docs_kwargs in app/main.py). See ADR-0011.
    if not settings.exposes_dev_tooling:
        raise _NOT_FOUND
    code = _dev_otp_codes(request.app).get(email.lower())
    if code is None:
        raise _NOT_FOUND
    return OtpDevPeekRead(code=code)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # No token blacklist: bumping the version invalidates every access token
    # issued for this user in one step (see get_current_user in
    # app/core/jwt.py), including the one used to call this endpoint.
    current_user.token_version += 1
    db.commit()
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
