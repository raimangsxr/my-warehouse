from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "my-warehouse-api"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./my_warehouse.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    frontend_url: str = "http://localhost:4200"
    secret_encryption_key: str = "change-me-secret-key"


settings = Settings()
