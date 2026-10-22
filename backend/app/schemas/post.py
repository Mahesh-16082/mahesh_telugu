from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PostStatus = Literal["DRAFT", "PUBLISHED"]


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    short_description: str | None = Field(default=None, max_length=500)
    content: str = ""
    featured_image_url: str | None = Field(default=None, max_length=2048)
    status: PostStatus = "DRAFT"

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    short_description: str | None = Field(default=None, max_length=500)
    content: str | None = None
    # Image URLs are changed through POST /api/posts/{post_id}/image.
    featured_image_url: str | None = Field(default=None, max_length=2048)
    status: PostStatus | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class PostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    short_description: str | None
    content: str
    featured_image_url: str | None
    image_public_id: str | None
    status: PostStatus
    is_deleted: bool
    author_id: int
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
