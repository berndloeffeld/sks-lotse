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


_INSECURE_JWT_SECRETS = {"", "change-me"}


def _reject_insecure_production_secret(s: Settings) -> None:
    # A required field only catches JWT_SECRET being unset entirely — it
    # doesn't catch a placeholder value making it into the real Render
    # dashboard by mistake. Fail loudly at startup for that case too, rather
    # than serving traffic with a forgeable secret.
    if s.is_production and s.jwt_secret in _INSECURE_JWT_SECRETS:
        raise RuntimeError(
            "JWT_SECRET is unset or a known placeholder value in production. "
            "Set a real random secret in the Render dashboard (see CLAUDE.md)."
        )


settings = Settings()
_reject_insecure_production_secret(settings)
