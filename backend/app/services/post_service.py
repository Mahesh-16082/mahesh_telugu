import csv
import io
import re
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.categories import Category
from app.models.post import Post
from app.models.user import User
from app.schemas.post import (
    PostBulkActionRequest,
    PostBulkActionResult,
    PostCreate,
    PostDraftCreate,
    PostStatusCounts,
    PostUpdate,
)

PRIVILEGED_ROLES = {"MASTER_ADMIN", "ADMIN", "EDITOR"}
ADMIN_ROLES = {"MASTER_ADMIN", "ADMIN"}
VALID_STATUSES = {"DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def make_slug(value: str) -> str:
    # Support Unicode word characters (including Telugu letters)
    slug = re.sub(r"[^\w]+", "-", value.lower(), flags=re.UNICODE).strip("-")
    return slug or "post"


def generate_unique_slug(
    db: Session,
    value: str,
    *,
    exclude_post_id: int | None = None,
) -> str:
    base_slug = make_slug(value)
    candidate = base_slug
    counter = 2

    while True:
        query = select(Post.id).where(Post.slug == candidate)
        if exclude_post_id is not None:
            query = query.where(Post.id != exclude_post_id)
        if db.scalar(query) is None:
            return candidate
        candidate = f"{base_slug}-{counter}"
        counter += 1


def ensure_can_manage_post(user: User, post: Post) -> None:
    if user.role not in PRIVILEGED_ROLES and post.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this post.",
        )


def ensure_admin(user: User) -> None:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator permission is required.",
        )


def validate_category_exists(db: Session, category_id: int | None) -> None:
    if category_id is not None:
        cat = db.scalar(
            select(Category).where(
                Category.id == category_id,
                Category.is_deleted.is_(False),
            )
        )
        if cat is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with ID {category_id} does not exist or has been deleted.",
            )


def get_post_or_404(
    db: Session,
    post_id: int,
    *,
    include_deleted: bool = False,
) -> Post:
    query = select(Post).where(Post.id == post_id)
    if not include_deleted:
        query = query.where(Post.is_deleted.is_(False))
    post = db.scalar(query)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    return post


def create_post(db: Session, payload: PostCreate, current_user: User) -> Post:
    title = payload.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Title cannot be empty.",
        )

    validate_category_exists(db, payload.category_id)

    slug_source = payload.slug.strip() if payload.slug else title
    slug = generate_unique_slug(db, slug_source)

    status_value = payload.status
    if status_value not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid status '{status_value}'.",
        )

    now = utc_now()
    published_at = None
    if status_value == "PUBLISHED":
        published_at = now

    post = Post(
        title=title,
        slug=slug,
        summary=payload.summary.strip() if payload.summary else (payload.short_description.strip() if payload.short_description else None),
        short_description=payload.short_description.strip() if payload.short_description else (payload.summary.strip() if payload.summary else None),
        content=payload.content or "",
        featured_image=payload.featured_image or payload.featured_image_url,
        featured_image_url=payload.featured_image_url or payload.featured_image,
        image_public_id=payload.image_public_id,
        category_id=payload.category_id,
        status=status_value,
        is_featured=payload.is_featured,
        is_breaking_news=payload.is_breaking_news,
        seo_title=payload.seo_title.strip() if payload.seo_title else None,
        seo_description=payload.seo_description.strip() if payload.seo_description else None,
        scheduled_at=payload.scheduled_at,
        published_at=published_at,
        author_id=current_user.id,
        is_deleted=False,
    )

    try:
        db.add(post)
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def create_draft(db: Session, payload: PostDraftCreate, current_user: User) -> Post:
    title = payload.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Title cannot be empty.",
        )

    validate_category_exists(db, payload.category_id)

    slug_source = payload.slug.strip() if payload.slug else title
    slug = generate_unique_slug(db, slug_source)

    post = Post(
        title=title,
        slug=slug,
        summary=payload.summary.strip() if payload.summary else (payload.short_description.strip() if payload.short_description else None),
        short_description=payload.short_description.strip() if payload.short_description else (payload.summary.strip() if payload.summary else None),
        content=payload.content or "",
        featured_image=payload.featured_image or payload.featured_image_url,
        featured_image_url=payload.featured_image_url or payload.featured_image,
        image_public_id=payload.image_public_id,
        category_id=payload.category_id,
        status="DRAFT",
        is_featured=payload.is_featured,
        is_breaking_news=payload.is_breaking_news,
        seo_title=payload.seo_title.strip() if payload.seo_title else None,
        seo_description=payload.seo_description.strip() if payload.seo_description else None,
        author_id=current_user.id,
        is_deleted=False,
    )

    try:
        db.add(post)
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def update_post(
    db: Session,
    post_id: int,
    payload: PostUpdate,
    current_user: User,
    *,
    is_put: bool = False,
) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=True)
    ensure_can_manage_post(current_user, post)

    changes = payload.model_dump(exclude_unset=not is_put)

    if "category_id" in changes:
        validate_category_exists(db, changes["category_id"])
        post.category_id = changes["category_id"]

    if "title" in changes and changes["title"] is not None:
        title = changes["title"].strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Title cannot be empty.",
            )
        if title != post.title:
            post.slug = generate_unique_slug(db, title, exclude_post_id=post.id)
        post.title = title

    if "slug" in changes and changes["slug"] is not None:
        slug_val = changes["slug"].strip()
        if slug_val:
            post.slug = generate_unique_slug(db, slug_val, exclude_post_id=post.id)

    if "summary" in changes or "short_description" in changes:
        summ = changes.get("summary") or changes.get("short_description")
        clean_summ = summ.strip() if isinstance(summ, str) else summ
        post.summary = clean_summ
        post.short_description = clean_summ

    if "content" in changes:
        post.content = changes["content"] or ""

    if "featured_image" in changes or "featured_image_url" in changes:
        img = changes.get("featured_image") or changes.get("featured_image_url")
        post.featured_image = img
        post.featured_image_url = img

    if "image_public_id" in changes:
        post.image_public_id = changes["image_public_id"]

    if "status" in changes and changes["status"] is not None:
        new_status = changes["status"]
        if new_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid status '{new_status}'.",
            )
        post.status = new_status
        if new_status == "PUBLISHED" and post.published_at is None:
            post.published_at = utc_now()
        elif new_status == "DRAFT":
            post.published_at = None

    if "is_featured" in changes and changes["is_featured"] is not None:
        post.is_featured = bool(changes["is_featured"])

    if "is_breaking_news" in changes and changes["is_breaking_news"] is not None:
        post.is_breaking_news = bool(changes["is_breaking_news"])

    if "seo_title" in changes:
        st = changes["seo_title"]
        post.seo_title = st.strip() if isinstance(st, str) else st

    if "seo_description" in changes:
        sd = changes["seo_description"]
        post.seo_description = sd.strip() if isinstance(sd, str) else sd

    if "scheduled_at" in changes:
        post.scheduled_at = changes["scheduled_at"]

    post.updated_at = utc_now()

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def publish_post(db: Session, post_id: int, current_user: User) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=False)
    ensure_can_manage_post(current_user, post)

    post.status = "PUBLISHED"
    post.published_at = utc_now()
    post.scheduled_at = None
    post.updated_at = utc_now()

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def unpublish_post(db: Session, post_id: int, current_user: User) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=False)
    ensure_can_manage_post(current_user, post)

    post.status = "DRAFT"
    post.published_at = None
    post.scheduled_at = None
    post.updated_at = utc_now()

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def schedule_post(
    db: Session,
    post_id: int,
    scheduled_at: datetime,
    current_user: User,
) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=False)
    ensure_can_manage_post(current_user, post)

    now = utc_now()
    # Check that scheduled_at is in the future
    if scheduled_at <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Scheduled publication time must be in the future.",
        )

    post.status = "SCHEDULED"
    post.scheduled_at = scheduled_at
    post.published_at = None
    post.updated_at = now

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def move_post_to_trash(db: Session, post_id: int, current_user: User) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=True)
    ensure_can_manage_post(current_user, post)

    post.is_deleted = True
    post.deleted_at = utc_now()
    post.updated_at = utc_now()

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def restore_post(db: Session, post_id: int, current_user: User) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=True)
    ensure_can_manage_post(current_user, post)

    if not post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Post is not in Trash.",
        )

    post.is_deleted = False
    post.deleted_at = None
    post.updated_at = utc_now()

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def permanently_delete_post(db: Session, post_id: int, current_user: User) -> str | None:
    ensure_admin(current_user)

    post = get_post_or_404(db, post_id, include_deleted=True)
    if not post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Move the post to Trash before permanently deleting it.",
        )

    image_public_id = post.image_public_id
    try:
        db.delete(post)
        db.commit()
        return image_public_id
    except Exception:
        db.rollback()
        raise


def duplicate_post(db: Session, post_id: int, current_user: User) -> Post:
    original = get_post_or_404(db, post_id, include_deleted=True)
    ensure_can_manage_post(current_user, original)

    new_title = f"{original.title} (Copy)"
    new_slug = generate_unique_slug(db, new_title)

    copy_post = Post(
        title=new_title,
        slug=new_slug,
        summary=original.summary,
        short_description=original.short_description,
        content=original.content,
        featured_image=original.featured_image,
        featured_image_url=original.featured_image_url,
        image_public_id=original.image_public_id,
        category_id=original.category_id,
        status="DRAFT",
        is_featured=original.is_featured,
        is_breaking_news=original.is_breaking_news,
        seo_title=original.seo_title,
        seo_description=original.seo_description,
        author_id=current_user.id,
        is_deleted=False,
        published_at=None,
        scheduled_at=None,
    )

    try:
        db.add(copy_post)
        db.commit()
        db.refresh(copy_post)
        return copy_post
    except Exception:
        db.rollback()
        raise


def toggle_featured(db: Session, post_id: int, current_user: User) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=False)
    ensure_can_manage_post(current_user, post)

    post.is_featured = not post.is_featured
    post.updated_at = utc_now()

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def toggle_breaking(db: Session, post_id: int, current_user: User) -> Post:
    post = get_post_or_404(db, post_id, include_deleted=False)
    ensure_can_manage_post(current_user, post)

    post.is_breaking_news = not post.is_breaking_news
    post.updated_at = utc_now()

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


def perform_bulk_action(
    db: Session,
    payload: PostBulkActionRequest,
    current_user: User,
) -> PostBulkActionResult:
    action = payload.action
    post_ids = list(set(payload.post_ids))

    if action == "permanent_delete":
        ensure_admin(current_user)

    if action == "change_category":
        validate_category_exists(db, payload.category_id)

    query = select(Post).where(Post.id.in_(post_ids))
    posts = list(db.scalars(query).all())
    found_ids = {p.id for p in posts}

    failed_ids = [pid for pid in post_ids if pid not in found_ids]
    success_count = 0

    now = utc_now()

    for post in posts:
        # Check authorization
        if current_user.role not in PRIVILEGED_ROLES and post.author_id != current_user.id:
            failed_ids.append(post.id)
            continue

        try:
            if action == "trash":
                post.is_deleted = True
                post.deleted_at = now
                post.updated_at = now
                success_count += 1

            elif action == "restore":
                if not post.is_deleted:
                    failed_ids.append(post.id)
                    continue
                post.is_deleted = False
                post.deleted_at = None
                post.updated_at = now
                success_count += 1

            elif action == "permanent_delete":
                if not post.is_deleted:
                    failed_ids.append(post.id)
                    continue
                db.delete(post)
                success_count += 1

            elif action == "publish":
                if post.is_deleted:
                    failed_ids.append(post.id)
                    continue
                post.status = "PUBLISHED"
                post.published_at = now
                post.scheduled_at = None
                post.updated_at = now
                success_count += 1

            elif action == "unpublish":
                if post.is_deleted:
                    failed_ids.append(post.id)
                    continue
                post.status = "DRAFT"
                post.published_at = None
                post.scheduled_at = None
                post.updated_at = now
                success_count += 1

            elif action == "change_category":
                post.category_id = payload.category_id
                post.updated_at = now
                success_count += 1

        except Exception:
            failed_ids.append(post.id)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to commit bulk action to database.",
        )

    return PostBulkActionResult(
        action=action,
        success_count=success_count,
        failure_count=len(failed_ids),
        failed_ids=failed_ids,
        message=f"Bulk action '{action}' completed with {success_count} succeeded and {len(failed_ids)} failed.",
    )


def get_status_counts(db: Session, current_user: User) -> PostStatusCounts:
    base_filter = []
    if current_user.role not in PRIVILEGED_ROLES:
        base_filter.append(Post.author_id == current_user.id)

    # Active posts counts by status
    active_query = (
        select(Post.status, func.count(Post.id))
        .where(Post.is_deleted.is_(False), *base_filter)
        .group_by(Post.status)
    )
    status_map = dict(db.execute(active_query).all())

    # Trashed posts count
    trash_query = select(func.count(Post.id)).where(
        Post.is_deleted.is_(True), *base_filter
    )
    trash_count = db.scalar(trash_query) or 0

    published_count = status_map.get("PUBLISHED", 0)
    draft_count = status_map.get("DRAFT", 0)
    scheduled_count = status_map.get("SCHEDULED", 0)
    archived_count = status_map.get("ARCHIVED", 0)
    all_active_count = sum(status_map.values())

    return PostStatusCounts(
        all=all_active_count,
        published=published_count,
        draft=draft_count,
        trash=trash_count,
        scheduled=scheduled_count,
        archived=archived_count,
    )


def export_posts_csv(
    db: Session,
    current_user: User,
    status_filter: str | None = None,
    category_id: int | None = None,
    author_id: int | None = None,
    search: str | None = None,
    is_featured: bool | None = None,
    is_breaking_news: bool | None = None,
    start_date: datetime | date | None = None,
    end_date: datetime | date | None = None,
) -> str:
    query = select(Post).where(Post.is_deleted.is_(False))

    if current_user.role not in PRIVILEGED_ROLES:
        query = query.where(Post.author_id == current_user.id)
    elif author_id is not None:
        query = query.where(Post.author_id == author_id)

    if status_filter:
        query = query.where(Post.status == status_filter.upper())

    if category_id is not None:
        query = query.where(Post.category_id == category_id)

    if is_featured is not None:
        query = query.where(Post.is_featured == is_featured)

    if is_breaking_news is not None:
        query = query.where(Post.is_breaking_news == is_breaking_news)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Post.title.ilike(term),
                Post.summary.ilike(term),
                Post.short_description.ilike(term),
                Post.slug.ilike(term),
            )
        )

    if start_date is not None:
        query = query.where(Post.created_at >= start_date)

    if end_date is not None:
        query = query.where(Post.created_at <= end_date)

    query = query.order_by(Post.created_at.desc())
    posts = list(db.scalars(query).all())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Title",
        "Slug",
        "Category",
        "Status",
        "Author",
        "Author Email",
        "Is Featured",
        "Is Breaking News",
        "Published At",
        "Created At",
        "Updated At",
    ])

    for post in posts:
        cat_name = post.category.name if post.category else ""
        auth_name = post.author.display_name if post.author else ""
        auth_email = post.author.email if post.author else ""
        pub_at = post.published_at.isoformat() if post.published_at else ""
        created_at = post.created_at.isoformat() if post.created_at else ""
        updated_at = post.updated_at.isoformat() if post.updated_at else ""

        writer.writerow([
            post.id,
            post.title,
            post.slug,
            cat_name,
            post.status,
            auth_name,
            auth_email,
            "Yes" if post.is_featured else "No",
            "Yes" if post.is_breaking_news else "No",
            pub_at,
            created_at,
            updated_at,
        ])

    return output.getvalue()
