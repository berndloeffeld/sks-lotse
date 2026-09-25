"""TOTP second factor for the admin area (ADR-0047): secret handling, code checks, freshness."""

import base64
import hashlib
import hmac
from datetime import datetime

import pyotp
import segno
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

ISSUER = "SKS Lotse"
# One step either side of the current 30-second one, for clock drift between phone and server.
_VALID_WINDOW = 1


def _fernet() -> Fernet:
    # Derived from JWT_SECRET like the OTP hash key (app/core/otp.py): one secret to manage,
    # independent keys per purpose. Rotating JWT_SECRET makes stored secrets unreadable, so the
    # admins enrol again (docs/RUNBOOK.md → Reset an admin's 2FA).
    key = hmac.new(settings.jwt_secret.encode(), b"sks-lotse/totp-secret-key", hashlib.sha256).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def new_secret() -> str:
    return pyotp.random_base32()


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(token: str) -> str | None:
    """The plain secret, or None if it was encrypted under another JWT_SECRET."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)


def qr_data_uri(uri: str) -> str:
    """The QR code for `uri` as an SVG data URI, for an <img> (CSP img-src allows data:)."""
    return segno.make(uri, error="m").svg_data_uri(scale=5, border=2)


def accepted_counter(secret: str, code: str, last_counter: int | None, now: datetime) -> int | None:
    """The time step `code` is valid for, or None.

    A step at or before `last_counter` is refused, so a code seen once (shoulder-surfed, or
    replayed from a log) can't open a second session.
    """
    code = code.replace(" ", "")
    totp = pyotp.TOTP(secret)
    current = totp.timecode(now)
    for counter in range(current - _VALID_WINDOW, current + _VALID_WINDOW + 1):
        if last_counter is not None and counter <= last_counter:
            continue
        if hmac.compare_digest(totp.generate_otp(counter), code):
            return counter
    return None


def mfa_is_fresh(mfa_at: object, now: datetime) -> bool:
    """Whether a session's `mfa` claim (unix time of its last TOTP check) still counts."""
    if not isinstance(mfa_at, int) or isinstance(mfa_at, bool):
        return False
    age_seconds = now.timestamp() - mfa_at
    return 0 <= age_seconds <= settings.admin_mfa_max_age_minutes * 60
