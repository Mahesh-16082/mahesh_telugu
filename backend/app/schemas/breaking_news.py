
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


BreakingNewsStatus = Literal["ACTIVE", "INACTIVE"]


class BreakingNewsCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    post_id: int | None = Field(default=None, gt=0)
    redirect_url: str | None = Field(default=None, max_length=2048)
    status: BreakingNewsStatus = "ACTIVE"

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Breaking news title cannot be empty.")
        return value

    @field_validator("redirect_url")
    @classmethod
    def validate_redirect_url(cls, value: str | None) -> str | None:
        if value is None:
            return value

        value = value.strip()
        return value or None


class BreakingNewsUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    post_id: int | None = Field(default=None, gt=0)
    redirect_url: str | None = Field(default=None, max_length=2048)
    status: BreakingNewsStatus | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return value

        value = value.strip()
        if not value:
            raise ValueError("Breaking news title cannot be empty.")
        return value

    @field_validator("redirect_url")
    @classmethod
    def validate_redirect_url(cls, value: str | None) -> str | None:
        if value is None:
            return value

        value = value.strip()
        return value or None


class BreakingNewsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    post_id: int | None = None
    redirect_url: str | None = None
    status: BreakingNewsStatus
    created_at: datetime
    updated_at: datetime
