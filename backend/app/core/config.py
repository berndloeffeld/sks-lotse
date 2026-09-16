from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = "change-me"
    jwt_access_token_expires_minutes: int = 43200  # 30 days
    openai_api_key: str = ""
    adsense_client_id: str = ""
    resend_api_key: str = ""
    email_from_address: str = "noreply@sks-lotse.de"


settings = Settings()
