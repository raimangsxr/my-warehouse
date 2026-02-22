from pydantic import BaseModel, Field


class SMTPSettingsResponse(BaseModel):
    warehouse_id: str
    host: str | None = None
    port: int | None = None
    username: str | None = None
    encryption_mode: str | None = None
    from_address: str | None = None
    from_name: str | None = None
    has_password: bool
    password_masked: str | None = None


class SMTPSettingsUpdateRequest(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    username: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, max_length=255)
    encryption_mode: str = Field(default="starttls", max_length=32)
    from_address: str = Field(min_length=3, max_length=255)
    from_name: str | None = Field(default=None, max_length=255)


class SMTPTestRequest(BaseModel):
    to_email: str = Field(min_length=3, max_length=255)


class LLMSettingsResponse(BaseModel):
    warehouse_id: str
    provider: str
    auto_tags_enabled: bool
    auto_alias_enabled: bool
    has_api_key: bool
    api_key_masked: str | None = None


class LLMSettingsUpdateRequest(BaseModel):
    provider: str = Field(default="gemini", max_length=32)
    api_key: str | None = Field(default=None, max_length=1024)
    auto_tags_enabled: bool = True
    auto_alias_enabled: bool = True


class LLMReprocessResponse(BaseModel):
    message: str
    item_id: str
