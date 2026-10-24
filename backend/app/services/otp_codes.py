"""Issuing, checking and cleaning up one-time codes (login and email change, ADR-0008/0010).

The routes in app/api/v1/auth.py decide *whether* to issue or accept a code for a request; this
module owns how codes are stored, throttled, delivered and consumed. Hashing and the code format
live in app/core/otp.py.
"""

import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi import BackgroundTasks, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core import cache
from app.core.config import settings
from app.core.otp import (
    OTP_PURPOSE_LOGIN,
    generate_code,
    generate_link_token,
    hash_code,
    hash_link_token,
    verify_code,
)
from app.core.site import Site
from app.core.timeutil import as_utc
from app.models import OtpCode
from app.services import blocklist
from app.services import email as email_service

logger = logging.getLogger(__name__)


def dev_otp_codes(app) -> dict[str, tuple[str, str | None]]:
    # Plaintext codes (and link tokens, None for an email change) only ever
    # exist here — otp_codes.code_hash/link_hash are one-way, by design. Gated to settings.exposes_dev_tooling
    # and never populated at all outside it (see issue_code), so this doesn't add
    # a standing plaintext-code store to the deployed app.
    if not hasattr(app.state, "dev_otp_codes"):
        app.state.dev_otp_codes = {}
    return app.state.dev_otp_codes


def _latest_code(
    db: Session, email: str, purpose: str, user_id: int | None = None, for_update: bool = False
) -> OtpCode | None:
    # Order by id, not created_at: created_at's DB-side timestamp resolution
    # (e.g. 1s on SQLite) can tie for two requests issued in quick succession,
    # while id is always monotonically increasing.
    stmt = select(OtpCode).where(OtpCode.email == email, OtpCode.purpose == purpose)
    if user_id is not None:
        stmt = stmt.where(OtpCode.user_id == user_id)
    stmt = stmt.order_by(OtpCode.id.desc()).limit(1)
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


def send_login_code(email: str, code: str, link_token: str | None, *, site: Site) -> None:
    # Runs as a background task: keeps Resend's latency out of the response,
    # which also narrows the timing difference between a real send and the
    # silent no-op paths in request_otp (allowlist, cooldown, ...).
    try:
        email_service.send_otp_email(email, code, link_token, site=site)
    except Exception:
        logger.exception("Failed to send OTP email to %s", _mask_email(email))


def send_email_change_code(email: str, code: str, _link_token: str | None, *, site: Site) -> None:
    # Never gets a link (issue_code mints one for login codes only): confirming a new address
    # needs the logged-in session, which a link opened elsewhere wouldn't have.
    try:
        email_service.send_email_change_otp_email(email, code, site=site)
    except Exception:
        logger.exception("Failed to send email-change confirmation to %s", _mask_email(email))


def send_email_change_notice(old_email: str, new_email: str, *, site: Site) -> None:
    # Background task after a confirmed change; a failed send must not undo or fail the change.
    try:
        email_service.send_email_change_notice_email(old_email, _mask_email(new_email), site=site)
    except Exception:
        logger.exception("Failed to send email-change notice to %s", _mask_email(old_email))


def _cleanup_expired_codes(session_factory: sessionmaker[Session], now: datetime) -> None:
    # otp_codes is pure transient data (see docs/adr/0010) — nothing outside
    # the OTP flow itself reads a code once it's past its retention window.
    # Runs as a FastAPI background task, gated by cache.throttle (see
    # issue_code) so it fires on a bounded cadence rather than once per
    # request — a separate job/schedule would work too, but this needs no
    # new infrastructure, and the DELETE doesn't add latency to the response
    # the caller is waiting on either way; see ADR-0010. Opens its own
    # session rather than borrowing the request's: that request has already
    # returned its response by the time this runs, and its get_db session is
    # scoped to it.
    cutoff = now - timedelta(hours=settings.otp_code_retention_hours)
    # synchronize_session=False: nothing holds a reference to an
    # about-to-be-deleted row, so there's no session-local ORM state that
    # needs to stay in sync — and evaluating the WHERE clause against the
    # session's identity map (the default "evaluate" strategy) chokes on
    # SQLite's naive datetimes (see `as_utc`) vs this tz-aware cutoff.
    stmt = delete(OtpCode).where(OtpCode.expires_at < cutoff).execution_options(synchronize_session=False)
    with session_factory() as db:
        db.execute(stmt)
        # Same cadence, same session: email blocklist entries past their retention (ADR-0045
        # addendum 2026-10-01). Login traffic is what drives both, so neither needs its own job.
        blocklist.purge_expired(db, now)
        db.commit()


def issue_code(
    db: Session,
    request: Request,
    background_tasks: BackgroundTasks,
    session_factory: sessionmaker[Session],
    email: str,
    purpose: str,
    send: Callable[[str, str, str | None], None],
    user_id: int | None = None,
) -> None:
    """Store a fresh code for (email, purpose) and email it — unless throttled.

    Throttling is silent: both callers answer the same generic 202 either way,
    so a caller can't tell a sent code from a suppressed one. The hourly cap and
    the resend cooldown are both scoped to (email, purpose) — see
    OTP_PURPOSE_LOGIN in app/core/otp.py for why. They deliberately ignore
    user_id: they protect the target inbox, whoever is asking.
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

    latest = _latest_code(db, email, purpose)
    if latest is not None and (now - as_utc(latest.created_at)) < timedelta(
        seconds=settings.otp_resend_cooldown_seconds
    ):
        return

    if cache.throttle(request.app, "otp_cleanup:sweep", settings.otp_cleanup_min_interval_seconds):
        background_tasks.add_task(_cleanup_expired_codes, session_factory, now)

    code = generate_code()
    link_token = generate_link_token() if purpose == OTP_PURPOSE_LOGIN else None
    otp = OtpCode(
        email=email,
        purpose=purpose,
        user_id=user_id,
        code_hash=hash_code(code),
        link_hash=hash_link_token(link_token) if link_token is not None else None,
        expires_at=now + timedelta(minutes=settings.otp_ttl_minutes),
    )
    db.add(otp)
    db.commit()

    if settings.exposes_dev_tooling:
        dev_otp_codes(request.app)[email] = (code, link_token)

    background_tasks.add_task(send, email, code, link_token)


def consume_code(db: Session, email: str, purpose: str, code: str, user_id: int | None = None) -> bool:
    """True (and marks it used) if `code` is the live latest code for (email, purpose[, user_id]).

    Only the most recent code counts, a wrong guess uses up one of its
    otp_max_attempts, and a code issued for another purpose (or, for an
    email change, requested by another account) never matches.
    Callers raise their own error on False (401 for login, 400 for an
    email change — see _invalid_email_change_code).
    """
    otp = _latest_code(db, email, purpose, user_id=user_id, for_update=True)
    if otp is None:
        return False

    now = datetime.now(UTC)
    not_consumed_or_expired = otp.consumed_at is None and as_utc(otp.expires_at) > now
    valid = not_consumed_or_expired and otp.attempts < settings.otp_max_attempts
    if valid:
        valid = verify_code(code, otp.code_hash)

    if valid:
        otp.consumed_at = now
    else:
        otp.attempts += 1
    db.commit()
    return valid


def consume_link_token(db: Session, token: str) -> str | None:
    """The address to sign in (and the row marked used) if `token` is a live login link, else None.

    The same rules as the code it was mailed with (it redeems the same row): only the latest login
    code for that address counts, once, until it expires. Not otp.attempts, though: those protect
    the 6-digit code from guessing, which a 256-bit token doesn't need — and an attacker who burns
    them with wrong codes for the victim's address must not take the victim's link down with them.
    """
    stmt = select(OtpCode).where(OtpCode.link_hash == hash_link_token(token)).with_for_update()
    otp = db.execute(stmt).scalars().first()
    if otp is None or otp.purpose != OTP_PURPOSE_LOGIN:
        return None
    latest = _latest_code(db, otp.email, OTP_PURPOSE_LOGIN)
    now = datetime.now(UTC)
    if latest is None or latest.id != otp.id or otp.consumed_at is not None or as_utc(otp.expires_at) <= now:
        return None
    otp.consumed_at = now
    db.commit()
    return otp.email
