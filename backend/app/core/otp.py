import hashlib
import hmac
import secrets

from disposable_email_domains import blocklist as disposable_email_domains

from app.core.config import settings


def generate_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(settings.otp_length))


def hash_code(code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def verify_code(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code), code_hash)


def is_disposable_email(email: str) -> bool:
    _, _, domain = email.rpartition("@")
    return domain.lower() in disposable_email_domains
