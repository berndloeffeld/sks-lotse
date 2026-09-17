import hashlib
import hmac
import secrets

from disposable_email_domains import blocklist as disposable_email_domains

from app.core.config import settings


def generate_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(settings.otp_length))


def _otp_hash_key() -> bytes:
    # Derived from JWT_SECRET rather than using it directly, so the same key
    # material isn't used for two different purposes (signing JWTs and
    # hashing OTP codes) — one secret to manage, two independent keys.
    return hmac.new(settings.jwt_secret.encode(), b"sks-lotse/otp-code-hash", hashlib.sha256).digest()


def hash_code(code: str) -> str:
    return hmac.new(_otp_hash_key(), code.encode(), hashlib.sha256).hexdigest()


def verify_code(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code), code_hash)


def is_disposable_email(email: str) -> bool:
    _, _, domain = email.rpartition("@")
    return domain.lower() in disposable_email_domains
