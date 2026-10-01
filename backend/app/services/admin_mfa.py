"""Admin 2FA enrolment and step-up (ADR-0047); the crypto and TOTP maths live in app/core/totp.py."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core import totp
from app.models import User
from app.schemas.admin import AdminMfaEnrolment
from app.services.user import locked_user


def is_enrolled(user: User) -> bool:
    return user.totp_enabled_at is not None


def start_enrolment(db: Session, user: User) -> AdminMfaEnrolment:
    """A new secret, pending until confirm_code accepts a code for it — replaces a pending one."""
    secret = totp.new_secret()
    user.totp_secret_encrypted = totp.encrypt_secret(secret)
    user.totp_last_counter = None
    db.commit()
    uri = totp.provisioning_uri(secret, user.email)
    return AdminMfaEnrolment(secret=secret, otpauth_uri=uri, qr_code=totp.qr_data_uri(uri))


def confirm_code(db: Session, user: User, code: str, now: datetime) -> bool:
    """Check `code` against the user's secret — the pending one while enrolling, else the active one.

    On success the time step is remembered (no replay) and a pending enrolment becomes active. The
    row is locked for the check, so two parallel requests can't both accept the same time step.
    """
    user = locked_user(db, user.id)
    counter = _accepted_counter(user, code, now)
    if counter is not None:
        user.totp_last_counter = counter
        if user.totp_enabled_at is None:
            user.totp_enabled_at = now
    db.commit()  # also releases the lock when the code is refused
    return counter is not None


def _accepted_counter(user: User, code: str, now: datetime) -> int | None:
    if user.totp_secret_encrypted is None:
        return None
    secret = totp.decrypt_secret(user.totp_secret_encrypted)
    if secret is None:
        return None
    return totp.accepted_counter(secret, code, user.totp_last_counter, now)


def reset(db: Session, user: User) -> bool:
    """Switch 2FA off and end every session (backend/scripts/reset_admin_totp.py).

    Returns whether there was anything to reset.
    """
    had_mfa = user.totp_secret_encrypted is not None
    user.totp_secret_encrypted = None
    user.totp_enabled_at = None
    user.totp_last_counter = None
    user.token_version += 1
    db.commit()
    return had_mfa
