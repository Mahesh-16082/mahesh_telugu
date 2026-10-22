
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


CategoryStatus = Literal["ACTIVE", "INACTIVE"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=300)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=2048)
    is_featured: bool = False
    display_order: int = Field(default=0, ge=0)
    status: CategoryStatus = "ACTIVE"

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Category name cannot be empty.")
        return value


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=300)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=2048)
    is_featured: bool | None = None
    display_order: int | None = Field(default=None, ge=0)
    status: CategoryStatus | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Category name cannot be empty.")
        return value


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    image_url: str | None
    is_featured: bool
    display_order: int
    status: CategoryStatus
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class CategoryReorderItem(BaseModel):
    id: int
    display_order: int = Field(ge=0)


class CategoryReorderRequest(BaseModel):
    categories: list[CategoryReorderItem] = Field(min_length=1)
