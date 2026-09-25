"""Admin 2FA enrolment and step-up (ADR-0047); the crypto and TOTP maths live in app/core/totp.py."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core import totp
from app.models import User
from app.schemas.admin import AdminMfaEnrolment


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

    On success the time step is remembered (no replay) and a pending enrolment becomes active.
    """
    if user.totp_secret_encrypted is None:
        return False
    secret = totp.decrypt_secret(user.totp_secret_encrypted)
    if secret is None:
        return False
    counter = totp.accepted_counter(secret, code, user.totp_last_counter, now)
    if counter is None:
        return False
    user.totp_last_counter = counter
    if user.totp_enabled_at is None:
        user.totp_enabled_at = now
    db.commit()
    return True


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
