from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = "change-me"
    openai_api_key: str = ""
    adsense_client_id: str = ""
    # Temporary pre-launch access gate for the API (see app/core/security.py).
    # Empty by default (local dev unaffected); set in prod to restrict access.
    access_gate_key: str = ""


settings = Settings()
