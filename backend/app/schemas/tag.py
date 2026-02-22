from pydantic import BaseModel


class TagResponse(BaseModel):
    name: str


class TagCloudEntry(BaseModel):
    tag: str
    count: int
