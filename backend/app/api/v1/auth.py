import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import cache
from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import SESSION_COOKIE_NAME, create_access_token, get_current_user
from app.core.otp import (
    OTP_PURPOSE_EMAIL_CHANGE,
    OTP_PURPOSE_LOGIN,
    generate_code,
    hash_code,
    is_disposable_email,
    verify_code,
)
from app.core.rate_limit import check_and_record
from app.models import OtpCode, User
from app.schemas.auth import (
    EmailChangeRequestCreate,
    EmailChangeVerifyRequest,
    OtpDevPeekRead,
    OtpRequestAccepted,
    OtpRequestCreate,
    OtpVerifyRequest,
    TokenRead,
    UserRead,
    UserUpdate,
)
from app.services import email as email_service
from app.services.user import delete_user_and_progress

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID_CODE = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")
# Deliberately NOT 401 like _INVALID_CODE above: this endpoint is called by an
# already-authenticated caller (unlike login's verify_otp), and the frontend's
# apiClient treats any 401 response, from any endpoint, as "the session is
# dead" and force-clears the logged-in user (see setUnauthorizedHandler in
# frontend/src/api/client.ts). Reusing 401 here would log the learner out of
# their still-valid session just for mistyping a confirmation code.
_INVALID_EMAIL_CHANGE_CODE = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code"
)
_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND)


def _dev_otp_codes(app) -> dict[str, str]:
    # Plaintext codes only ever exist here — otp_codes.code_hash (see
    # hash_code) is one-way, by design. Gated to settings.exposes_dev_tooling
    # and never populated at all outside it (see request_otp), so this doesn't add
    # a standing plaintext-code store to the deployed app.
    if not hasattr(app.state, "dev_otp_codes"):
        app.state.dev_otp_codes = {}
    return app.state.dev_otp_codes


def _latest_otp_code(db: Session, email: str, purpose: str, for_update: bool = False) -> OtpCode | None:
    # Order by id, not created_at: created_at's DB-side timestamp resolution
    # (e.g. 1s on SQLite) can tie for two requests issued in quick succession,
    # while id is always monotonically increasing.
    stmt = (
        select(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == purpose)
        .order_by(OtpCode.id.desc())
        .limit(1)
    )
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


def _send_email_change_otp_email(email: str, code: str) -> None:
    try:
        email_service.send_email_change_otp_email(email, code)
    except Exception:
        logger.exception("Failed to send email-change confirmation to %s", _mask_email(email))


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


def _issue_otp_code(
    db: Session,
    request: Request,
    background_tasks: BackgroundTasks,
    email: str,
    purpose: str,
    send: Callable[[str, str], None],
) -> None:
    """Store a fresh code for (email, purpose) and email it — unless throttled.

    Throttling is silent: both callers answer the same generic 202 either way,
    so a caller can't tell a sent code from a suppressed one. The hourly cap and
    the resend cooldown are both scoped to (email, purpose) — see
    OTP_PURPOSE_LOGIN in app/core/otp.py for why.
    """
    now = datetime.now(UTC)

    window_start = now - timedelta(minutes=settings.otp_request_window_minutes)
    recent_requests = db.execute(
        select(func.count())
        .select_from(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.created_at >= window_start)
    ).scalar_one()
    if recent_requests >= settings.otp_max_requests_per_window:
        return

    latest = _latest_otp_code(db, email, purpose)
    if latest is not None and (now - _as_utc(latest.created_at)) < timedelta(
        seconds=settings.otp_resend_cooldown_seconds
    ):
        return

    if cache.throttle(request.app, "otp_cleanup:sweep", settings.otp_cleanup_min_interval_seconds):
        background_tasks.add_task(_cleanup_expired_otp_codes, db, now)

    code = generate_code()
    otp = OtpCode(
        email=email,
        purpose=purpose,
        code_hash=hash_code(code),
        expires_at=now + timedelta(minutes=settings.otp_ttl_minutes),
    )
    db.add(otp)
    db.commit()

    if settings.exposes_dev_tooling:
        _dev_otp_codes(request.app)[email] = code

    background_tasks.add_task(send, email, code)


def _consume_otp_code(db: Session, email: str, purpose: str, code: str) -> bool:
    """True (and marks it used) if `code` is the live latest code for (email, purpose).

    Only the most recent code counts, a wrong guess uses up one of its
    otp_max_attempts, and a code issued for another purpose never matches.
    Callers raise their own error on False (401 for login, 400 for an
    email change — see _INVALID_EMAIL_CHANGE_CODE).
    """
    otp = _latest_otp_code(db, email, purpose, for_update=True)
    if otp is None:
        return False

    now = datetime.now(UTC)
    not_consumed_or_expired = otp.consumed_at is None and _as_utc(otp.expires_at) > now
    valid = not_consumed_or_expired and otp.attempts < settings.otp_max_attempts
    if valid:
        valid = verify_code(code, otp.code_hash)

    if valid:
        otp.consumed_at = now
    else:
        otp.attempts += 1
    db.commit()
    return valid


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

    _issue_otp_code(db, request, background_tasks, payload.email, OTP_PURPOSE_LOGIN, _send_otp_email)
    return OtpRequestAccepted()


@router.post("/otp/verify", response_model=TokenRead)
def verify_otp(payload: OtpVerifyRequest, response: Response, db: Session = Depends(get_db)):
    if not _consume_otp_code(db, payload.email, OTP_PURPOSE_LOGIN, payload.code):
        raise _INVALID_CODE

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
        # Secure cookies are dropped by browsers over plain http://, which
        # local dev uses — only require it once actually deployed.
        secure=settings.is_production,
        samesite="lax",
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


@router.patch("/me", response_model=UserRead)
def update_current_user(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # exclude_unset, not exclude_none: a field the caller left out of the
    # body must stay untouched, while one sent as explicit null must clear
    # it. Every UserUpdate field name matches a User column 1:1.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    delete_user_and_progress(db, current_user)
    # The account is gone, so the session cookie is now meaningless — clear
    # it the same way logout does. No token_version bump needed: the row
    # itself is gone, so get_current_user's next lookup already 401s.
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


@router.post("/me/email/request", response_model=OtpRequestAccepted, status_code=status.HTTP_202_ACCEPTED)
def request_email_change(
    payload: EmailChangeRequestCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_email = payload.new_email
    if new_email == current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is already your email address"
        )

    # Per-authenticated-user cap, independent of the per-IP rule on this path
    # (see app/main.py): that one alone doesn't stop this account probing
    # many target addresses from multiple IPs to learn which are taken.
    # Checked before anything that reveals something about the target address
    # (allowlist, taken) — a probe that gets a 403/409 must use up quota too.
    if not check_and_record(
        request.app,
        "email_change_request:user",
        str(current_user.id),
        settings.email_change_max_requests_per_window,
        settings.email_change_window_seconds,
    ):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")

    # During a private beta, an address outside ALLOWED_EMAILS would be a trap:
    # the change would go through, but /otp/request silently ignores that
    # address, so the learner could never log in again once this session ends.
    allowed_emails = settings.allowed_emails_set
    if allowed_emails is not None and new_email not in allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This email address is not allowed to sign in"
        )

    # Unlike request_otp's anonymous-login flow, the caller here is already
    # authenticated — telling them a target address is taken isn't the same
    # enumeration surface as anonymous login OTP, and the product requirement
    # is a clear "already taken" error rather than a silent generic 202.
    existing = db.execute(select(User).where(User.email == new_email)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This email address is already in use"
        )

    if is_disposable_email(new_email):
        return OtpRequestAccepted()

    _issue_otp_code(
        db, request, background_tasks, new_email, OTP_PURPOSE_EMAIL_CHANGE, _send_email_change_otp_email
    )
    return OtpRequestAccepted()


@router.post("/me/email/verify", response_model=UserRead)
def verify_email_change(
    payload: EmailChangeVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _consume_otp_code(db, payload.new_email, OTP_PURPOSE_EMAIL_CHANGE, payload.code):
        raise _INVALID_EMAIL_CHANGE_CODE

    current_user.email = payload.new_email
    try:
        db.commit()
    except IntegrityError:
        # Lost a race against another change/signup claiming this exact
        # address between the request-time uniqueness check and this commit.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This email address is already in use"
        ) from None

    db.refresh(current_user)
    # No token_version bump / re-login needed: the JWT doesn't embed the
    # email, so the existing session stays valid after this change.
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # No token blacklist: bumping the version invalidates every access token
    # issued for this user in one step (see get_current_user in
    # app/core/jwt.py), including the one used to call this endpoint.
    current_user.token_version += 1
    db.commit()
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
