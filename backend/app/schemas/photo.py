from pydantic import BaseModel, Field


class PhotoUploadResponse(BaseModel):
    photo_url: str = Field(min_length=1, max_length=500)
    content_type: str = Field(min_length=1, max_length=64)
    size_bytes: int = Field(ge=1)
