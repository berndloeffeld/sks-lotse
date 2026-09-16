from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    # "development" (default, matches local/CI) or "production" (set on
    # Render). Not a secret — a plain env var is fine.
    environment: str = "development"
    # No insecure fallback: this signs JWTs and hashes OTP codes, so an
    # unset value must fail loudly, not silently run with a known secret.
    jwt_secret: str
    jwt_access_token_expires_minutes: int = 10080  # 7 days
    openai_api_key: str = ""
    adsense_client_id: str = ""
    resend_api_key: str = ""
    email_from_address: str = "noreply@sks-lotse.de"
    # Comma-separated email allowlist for a pre-launch/private beta. Empty
    # (the default) means no whitelist — anyone can request/verify a login.
    allowed_emails: str = ""

    @property
    def allowed_emails_set(self) -> set[str] | None:
        if not self.allowed_emails.strip():
            return None
        return {email.strip().lower() for email in self.allowed_emails.split(",") if email.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_allowed_origins(self) -> list[str]:
        # No separate frontend deployment exists yet, so this is forward-looking:
        # the canonical/secondary domains in production (see CLAUDE.md, Naming /
        # Domain), the Vite dev server's default origin locally.
        if self.is_production:
            return ["https://sks-lotse.de", "https://www.sks-lotse.de"]
        return ["http://localhost:5173", "http://127.0.0.1:5173"]


# A real secret (e.g. `openssl rand -hex 32`) is 64 characters. This is a
# floor, not a target — it exists to reject short, human-typable/guessable
# values (a required field alone only catches JWT_SECRET being unset
# entirely, not a weak placeholder making it into the dashboard by mistake).
# Deliberately length-based rather than an exact-string blocklist: a
# blocklist only catches values someone thought to enumerate — it wouldn't
# have caught the "test-secret-not-for-production" placeholder this project
# uses in CI, for example.
_MIN_PRODUCTION_JWT_SECRET_LENGTH = 32


def _reject_insecure_production_secret(s: Settings) -> None:
    if s.is_production and len(s.jwt_secret) < _MIN_PRODUCTION_JWT_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET is missing or too short ({len(s.jwt_secret)} chars) for production "
            f"(minimum {_MIN_PRODUCTION_JWT_SECRET_LENGTH}). Set a real random secret in the "
            "Render dashboard, e.g. via `openssl rand -hex 32` (see CLAUDE.md)."
        )


settings = Settings()
_reject_insecure_production_secret(settings)
