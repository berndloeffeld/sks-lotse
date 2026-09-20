from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.email_address import canonicalize_email

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
    # Local dev tooling only (backend/scripts/manage_topics.py) — the running app never reads it.
    anthropic_api_key: str = ""
    # The running app's own key for the AI answer check (app/services/grader.py, ADR-0031),
    # deliberately separate from the dev-tooling key above (own workspace, own spend limit).
    # Empty = the check answers 503 instead of calling out.
    anthropic_grading_api_key: str = ""
    anthropic_grading_model: str = "claude-haiku-4-5"
    anthropic_grading_timeout_seconds: float = 15.0
    adsense_client_id: str = ""
    resend_api_key: str = ""
    # Display name + address, so inboxes show "SKS Lotse" rather than a bare
    # noreply address.
    email_from_address: str = "SKS Lotse <noreply@sks-lotse.de>"
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

    # Per-authenticated-user cap on POST /questions/{id}/report: bounds how much
    # free text one account can push into the operator's inbox.
    question_report_max_per_window: int = 20
    question_report_window_seconds: int = 3600  # 1 hour

    # AI answer check: the learner's answer is capped (tokens = cost) and each account
    # gets a per-hour budget on top of the blanket per-IP rule (app/main.py).
    grading_max_answer_chars: int = 1000
    grading_max_per_window: int = 30
    grading_window_seconds: int = 3600  # 1 hour
    # The real budget (ADR-0031): checks per account and calendar day (Europe/Berlin), persisted on
    # the user so a deploy doesn't reset it, plus a cap per question and day so nobody rephrases
    # until it says "richtig". At ~0.13 cent per check, 20/day is at most ~2.5 cent per account and day.
    grading_max_per_day: int = 20
    grading_max_per_question_per_day: int = 2

    catalog_cache_ttl_seconds: int = 3600  # 1 hour

    @property
    def allowed_emails_set(self) -> set[str] | None:
        if not self.allowed_emails.strip():
            return None
        return {canonicalize_email(email) for email in self.allowed_emails.split(",") if email.strip()}

    @property
    def admin_emails_set(self) -> set[str]:
        # Unlike allowed_emails_set, never returns None: an empty/unset value
        # must mean "no admins", not "unrestricted", so every caller can
        # write `email in settings.admin_emails_set` without a None guard.
        return {canonicalize_email(email) for email in self.admin_emails.split(",") if email.strip()}

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
        # The origins the frontend is served from: the sks-lotse-frontend static
        # site in production (see render.yaml, ADR-0015), the Vite dev server's
        # default origin locally.
        if self.is_production:
            return ["https://sks-lotse.de", "https://www.sks-lotse.de"]
        return ["http://localhost:5173", "http://127.0.0.1:5173"]


settings = Settings()
