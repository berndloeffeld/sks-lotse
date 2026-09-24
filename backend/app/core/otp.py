import hashlib
import hmac
import secrets

from disposable_email_domains import blocklist as disposable_email_domains

from app.core.config import settings
from app.core.email_address import domain_of

# What an otp_codes row can be redeemed for. A code is only ever accepted by
# the flow it was issued for: an email-change confirmation code must not work
# as a login code (that would mint a login for an address ALLOWED_EMAILS never
# let through /otp/request), and each purpose keeps its own per-address
# cooldown/hourly quota, so one flow can't starve the other.
OTP_PURPOSE_LOGIN = "login"
OTP_PURPOSE_EMAIL_CHANGE = "email_change"


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
    return domain_of(email) in disposable_email_domains
