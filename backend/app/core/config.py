from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# A real secret (e.g. `openssl rand -hex 32`) is 64 characters. This is a
# floor, not a target — it rejects empty, short, human-typable/guessable
# values in every environment (a required field alone only catches
# JWT_SECRET being absent entirely, not `JWT_SECRET=` copied verbatim from
# .env.example or a weak placeholder making it into the Render dashboard).
# Deliberately length-based rather than an exact-string blocklist: a
# blocklist only catches values someone thought to enumerate.
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    # "development" (default, matches local/CI), "test", or "production" (set
    # on Render). Not a secret — a plain env var is fine. A closed set rather
    # than a free string: a typo like "prod" must fail at startup, not
    # silently run production with dev-only tooling enabled (see
    # exposes_dev_tooling below).
    environment: Literal["development", "test", "production"] = "development"
    # Set to "true" by Render itself on every service (not configured by us).
    # Means Cloudflare/Render's proxy is in front of the app, so its
    # client-IP headers can be trusted for rate limiting (app/main.py).
    render: bool = False
    # No insecure fallback: this signs JWTs and (via a derived key, see
    # app/core/otp.py) hashes OTP codes, so an unset or weak value must fail
    # loudly, not silently run with a known secret.
    jwt_secret: str = Field(min_length=MIN_JWT_SECRET_LENGTH)
    jwt_access_token_expires_minutes: int = 10080  # 7 days
    openai_api_key: str = ""
    # Not read by the running app — only by backend/scripts/manage_topics.py,
    # a local dev-only classification tool (see CLAUDE.md → Question Catalog).
    anthropic_api_key: str = ""
    adsense_client_id: str = ""
    resend_api_key: str = ""
    email_from_address: str = "noreply@sks-lotse.de"
    # Comma-separated email allowlist for a pre-launch/private beta. Empty
    # (the default) means no whitelist — anyone can request/verify a login.
    allowed_emails: str = ""
    # Comma-separated email allowlist for the GDPR admin tools (app/core/jwt.py
    # require_admin). Deliberately the OPPOSITE default semantics of
    # allowed_emails above: empty/unset means NO ONE is an admin (fail
    # closed), not "open to everyone" — an unset env var must never grant
    # admin access.
    admin_emails: str = ""

    otp_length: int = 6
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60
    # Bounds sustained abuse (spamming one inbox, running up the Resend bill)
    # that the per-request cooldown alone doesn't catch.
    otp_request_window_minutes: int = 60
    otp_max_requests_per_window: int = 5
    # How long an expired code is kept around before cleanup deletes it — not
    # the same as otp_ttl_minutes, which governs how long a code is *usable*.
    otp_code_retention_hours: int = 24
    otp_cleanup_min_interval_seconds: int = 300  # 5 minutes

    rate_limit_otp_max_requests: int = 20
    rate_limit_otp_window_seconds: int = 3600  # 1 hour
    rate_limit_default_max_requests: int = 300
    rate_limit_default_window_seconds: int = 300  # 5 minutes

    # Per-authenticated-user cap on /auth/me/email/request, independent of
    # the per-IP rule above: that one alone doesn't stop a single account
    # probing many target addresses (to learn which are already taken) from
    # multiple IPs, or many accounts sharing one IP.
    email_change_max_requests_per_window: int = 5
    email_change_window_seconds: int = 3600  # 1 hour

    catalog_cache_ttl_seconds: int = 3600  # 1 hour

    @property
    def allowed_emails_set(self) -> set[str] | None:
        if not self.allowed_emails.strip():
            return None
        return {email.strip().lower() for email in self.allowed_emails.split(",") if email.strip()}

    @property
    def admin_emails_set(self) -> set[str]:
        # Unlike allowed_emails_set, never returns None: an empty/unset value
        # must mean "no admins", not "unrestricted", so every caller can
        # write `email in settings.admin_emails_set` without a None guard.
        return {email.strip().lower() for email in self.admin_emails.split(",") if email.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def exposes_dev_tooling(self) -> bool:
        # Opt-in allowlist, not `not is_production`: dev-only endpoints (e.g.
        # the OTP peek, see docs/adr/0011) must fail closed if this set ever
        # grows, rather than turning on for any environment that isn't
        # literally "production".
        return self.environment in ("development", "test")

    @property
    def cors_allowed_origins(self) -> list[str]:
        # No separate frontend deployment exists yet, so this is forward-looking:
        # the canonical/secondary domains in production (see CLAUDE.md, Naming /
        # Domain), the Vite dev server's default origin locally.
        if self.is_production:
            return ["https://sks-lotse.de", "https://www.sks-lotse.de"]
        return ["http://localhost:5173", "http://127.0.0.1:5173"]


settings = Settings()
