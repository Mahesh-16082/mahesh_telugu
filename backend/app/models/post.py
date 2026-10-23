from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.cors.database import Base


def utc_now() -> datetime:
    """Return the current UTC time."""
    return datetime.now(timezone.utc)


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), unique=True, index=True, nullable=False)
    
    # summary and short_description kept in sync for compatibility
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    short_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # featured_image and featured_image_url kept in sync for compatibility
    featured_image: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    featured_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_public_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default="DRAFT", nullable=False, index=True
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_featured: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    is_breaking_news: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    seo_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    author = relationship("User", foreign_keys=[author_id], lazy="joined")
    category = relationship("Category", foreign_keys=[category_id], lazy="joined")

    def __init__(self, **kwargs):
        # Sync summary and short_description
        if "summary" in kwargs and "short_description" not in kwargs:
            kwargs["short_description"] = kwargs["summary"]
        elif "short_description" in kwargs and "summary" not in kwargs:
            kwargs["summary"] = kwargs["short_description"]

        # Sync featured_image and featured_image_url
        if "featured_image" in kwargs and "featured_image_url" not in kwargs:
            kwargs["featured_image_url"] = kwargs["featured_image"]
        elif "featured_image_url" in kwargs and "featured_image" not in kwargs:
            kwargs["featured_image"] = kwargs["featured_image_url"]

        super().__init__(**kwargs)
