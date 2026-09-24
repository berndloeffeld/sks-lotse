import logging
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.database import get_db, get_session_factory
from app.core.email_address import canonicalize_email
from app.core.jwt import SESSION_COOKIE_NAME, create_access_token, get_current_user
from app.core.legal import CURRENT_AGB_VERSION
from app.core.otp import (
    OTP_PURPOSE_EMAIL_CHANGE,
    OTP_PURPOSE_LOGIN,
    is_disposable_email,
)
from app.core.pricing import signup_bonus_tokens
from app.core.rate_limit import check_and_record
from app.models import User
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
from app.services import blocklist, otp_codes, token_wallet
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


@router.post("/otp/request", response_model=OtpRequestAccepted, status_code=status.HTTP_202_ACCEPTED)
def request_otp(
    payload: OtpRequestCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    session_factory: sessionmaker[Session] = Depends(get_session_factory),
):
    allowed_emails = settings.allowed_emails_set
    if allowed_emails is not None and payload.email not in allowed_emails:
        # Same generic response as every other throttled/rejected case below —
        # doesn't leak whether this email is on the allowlist.
        return OtpRequestAccepted()

    if is_disposable_email(payload.email):
        return OtpRequestAccepted()

    if blocklist.is_email_blocked(request.app, db, payload.email):
        # Same generic 202 as every other rejected case above — a manually blocked address
        # (ADR-0045) gets no different a response than one outside the allowlist.
        return OtpRequestAccepted()

    otp_codes.issue_code(
        db,
        request,
        background_tasks,
        session_factory,
        payload.email,
        OTP_PURPOSE_LOGIN,
        otp_codes.send_login_code,
    )
    return OtpRequestAccepted()


@router.post("/otp/verify", response_model=TokenRead)
def verify_otp(payload: OtpVerifyRequest, response: Response, db: Session = Depends(get_db)):
    if not otp_codes.consume_code(db, payload.email, OTP_PURPOSE_LOGIN, payload.code):
        raise _INVALID_CODE

    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if user is None:
        user = User(email=payload.email)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # A concurrent first login for the same email created the row
            # between our lookup and this insert — use that one; it already
            # got its own signup bonus from that request.
            db.rollback()
            user = db.execute(select(User).where(User.email == payload.email)).scalar_one()
        else:
            db.refresh(user)
            # ADR-0043: a few free tokens so a new account can try the AI check, deliberately
            # too few to make re-registering worth it instead of buying more.
            token_wallet.grant(
                db,
                user.id,
                product="signup_bonus",
                tokens=signup_bonus_tokens(db),
                amount_eur_cents=None,
                granted_by="signup",
            )

    user.last_login_at = datetime.now(UTC)
    db.commit()

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
    code = otp_codes.dev_otp_codes(request.app).get(canonicalize_email(email))
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


@router.post("/me/agb-accept", response_model=UserRead)
def accept_agb(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # No version comes from the client — a caller can only ever confirm the
    # one version the server currently knows about, never claim to have
    # accepted a stale one. See frontend/src/routes/AgbGate.tsx.
    current_user.agb_accepted_version = CURRENT_AGB_VERSION
    current_user.agb_accepted_at = datetime.now(UTC)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/email/request", response_model=OtpRequestAccepted, status_code=status.HTTP_202_ACCEPTED)
def request_email_change(
    payload: EmailChangeRequestCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    session_factory: sessionmaker[Session] = Depends(get_session_factory),
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
    # Unlike login, where a disposable address gets the same silent 202 as
    # every other rejection (no enumeration signal for anonymous callers),
    # this caller is authenticated and would otherwise wait for a code that
    # never comes — say so instead.
    if is_disposable_email(new_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Disposable email addresses are not supported"
        )

    if blocklist.is_email_blocked(request.app, db, new_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This email address is not allowed"
        )

    existing = db.execute(select(User).where(User.email == new_email)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This email address is already in use"
        )

    otp_codes.issue_code(
        db,
        request,
        background_tasks,
        session_factory,
        new_email,
        OTP_PURPOSE_EMAIL_CHANGE,
        otp_codes.send_email_change_code,
        user_id=current_user.id,
    )
    return OtpRequestAccepted()


@router.post("/me/email/verify", response_model=UserRead)
def verify_email_change(
    payload: EmailChangeVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not otp_codes.consume_code(
        db, payload.new_email, OTP_PURPOSE_EMAIL_CHANGE, payload.code, user_id=current_user.id
    ):
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
