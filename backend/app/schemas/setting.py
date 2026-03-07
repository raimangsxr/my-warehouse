from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.llm import DEFAULT_GEMINI_MODEL_PRIORITY, SUPPORTED_GEMINI_MODELS, GeminiModelId


LLMOutputLanguage = Literal["es", "en"]


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
    language: LLMOutputLanguage
    model_priority: list[GeminiModelId] = Field(default_factory=lambda: list(DEFAULT_GEMINI_MODEL_PRIORITY))
    intake_parallelism: int = Field(default=4, ge=1, le=8)
    auto_tags_enabled: bool
    auto_alias_enabled: bool
    has_api_key: bool
    api_key_value: str | None = None


class LLMSettingsUpdateRequest(BaseModel):
    provider: str = Field(default="gemini", max_length=32)
    language: LLMOutputLanguage = "es"
    api_key: str | None = Field(default=None, max_length=1024)
    model_priority: list[GeminiModelId] = Field(default_factory=lambda: list(DEFAULT_GEMINI_MODEL_PRIORITY))
    intake_parallelism: int = Field(default=4, ge=1, le=8)
    auto_tags_enabled: bool = True
    auto_alias_enabled: bool = True

    @field_validator("model_priority")
    @classmethod
    def validate_model_priority(cls, value: list[GeminiModelId]) -> list[GeminiModelId]:
        if len(value) != len(SUPPORTED_GEMINI_MODELS):
            raise ValueError("model_priority must include all supported Gemini models")
        if len(set(value)) != len(SUPPORTED_GEMINI_MODELS):
            raise ValueError("model_priority must not include duplicates")
        if set(value) != set(SUPPORTED_GEMINI_MODELS):
            raise ValueError("model_priority includes unsupported models")
        return value


class LLMReprocessRequest(BaseModel):
    fields: list[Literal["tags", "aliases"]] = Field(default_factory=lambda: ["tags", "aliases"])


class LLMReprocessResponse(BaseModel):
    message: str
    item_id: str
    processed_fields: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)
