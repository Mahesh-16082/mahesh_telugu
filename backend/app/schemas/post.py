from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


PostStatus = Literal["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]


class AuthorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    email: str
    role: str


class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, max_length=500)
    short_description: str | None = Field(default=None, max_length=500)
    content: str = ""
    featured_image: str | None = Field(default=None, max_length=2048)
    featured_image_url: str | None = Field(default=None, max_length=2048)
    image_public_id: str | None = Field(default=None, max_length=255)
    category_id: int | None = None
    status: PostStatus = "DRAFT"
    is_featured: bool = False
    is_breaking_news: bool = False
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    scheduled_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class PostDraftCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, max_length=500)
    short_description: str | None = Field(default=None, max_length=500)
    content: str = ""
    featured_image: str | None = Field(default=None, max_length=2048)
    featured_image_url: str | None = Field(default=None, max_length=2048)
    image_public_id: str | None = Field(default=None, max_length=255)
    category_id: int | None = None
    is_featured: bool = False
    is_breaking_news: bool = False
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, max_length=500)
    short_description: str | None = Field(default=None, max_length=500)
    content: str | None = None
    featured_image: str | None = Field(default=None, max_length=2048)
    featured_image_url: str | None = Field(default=None, max_length=2048)
    image_public_id: str | None = Field(default=None, max_length=255)
    category_id: int | None = None
    status: PostStatus | None = None
    is_featured: bool | None = None
    is_breaking_news: bool | None = None
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    scheduled_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class PostScheduleRequest(BaseModel):
    scheduled_at: datetime


class PostBulkActionRequest(BaseModel):
    action: Literal[
        "trash",
        "restore",
        "permanent_delete",
        "publish",
        "unpublish",
        "change_category",
    ]
    post_ids: list[int] = Field(min_length=1)
    category_id: int | None = None


class PostBulkActionResult(BaseModel):
    action: str
    success_count: int
    failure_count: int
    failed_ids: list[int] = []
    message: str


class PostStatusCounts(BaseModel):
    all: int
    published: int
    draft: int
    trash: int
    scheduled: int
    archived: int


class PostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    summary: str | None = None
    short_description: str | None = None
    content: str
    featured_image: str | None = None
    featured_image_url: str | None = None
    image_public_id: str | None = None
    status: PostStatus
    is_deleted: bool
    deleted_at: datetime | None = None
    is_featured: bool
    is_breaking_news: bool
    seo_title: str | None = None
    seo_description: str | None = None
    author_id: int
    author: AuthorSummary | None = None
    category_id: int | None = None
    category: CategorySummary | None = None
    published_at: datetime | None = None
    scheduled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PostPaginatedResponse(BaseModel):
    items: list[PostResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
