import hashlib
import hmac
import secrets

from app.core.config import settings

OTP_LENGTH = 6
OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
# Bounds sustained abuse (spamming one inbox, running up the Resend bill)
# that a per-request cooldown alone doesn't catch.
OTP_REQUEST_WINDOW_MINUTES = 60
OTP_MAX_REQUESTS_PER_WINDOW = 5


def generate_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))


def hash_code(code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def verify_code(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code), code_hash)
