import re
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostResponse, PostUpdate
from app.services.cloudinary_service import delete_post_image, upload_post_image


router = APIRouter(prefix="/api/posts", tags=["Posts"])
PRIVILEGED_ROLES = {"MASTER_ADMIN", "ADMIN", "EDITOR"}
ADMIN_ROLES = {"MASTER_ADMIN", "ADMIN"}
VALID_STATUSES = {"DRAFT", "PUBLISHED"}


def make_slug(title: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")
    return slug or "post"


def generate_unique_slug(db: Session, title: str, *, exclude_post_id: int | None = None) -> str:
    base_slug = make_slug(title)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return post


def ensure_can_manage_post(user: User, post: Post) -> None:
    if user.role not in PRIVILEGED_ROLES and post.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this post.",
        )


def validate_post_status(value: str) -> None:
    if value not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Status must be DRAFT or PUBLISHED.",
        )


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    title: Annotated[str, Form(min_length=1, max_length=255)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    image: Annotated[UploadFile, File(...)],
    short_description: Annotated[str | None, Form(max_length=500)] = None,
    content: Annotated[str, Form()] = "",
    status_value: Annotated[str, Form(alias="status")] = "DRAFT",
):
    title = title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title cannot be empty.",
        )
    validate_post_status(status_value)

    uploaded_image = await upload_post_image(image)
    post = Post(
        title=title,
        slug=generate_unique_slug(db, title),
        short_description=short_description.strip() if short_description else None,
        content=content,
        featured_image_url=uploaded_image["image_url"],
        image_public_id=uploaded_image["public_id"],
        status=status_value,
        author_id=current_user.id,
        published_at=datetime.now(timezone.utc) if status_value == "PUBLISHED" else None,
    )

    try:
        db.add(post)
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        try:
            delete_post_image(uploaded_image["public_id"])
        except Exception:
            pass
        raise


@router.get("", response_model=list[PostResponse])
def list_posts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    post_status: str | None = Query(default=None, alias="status"),
    trash: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=255),
):
    query = select(Post)
    query = query.where(Post.is_deleted.is_(True) if trash else Post.is_deleted.is_(False))

    if current_user.role not in PRIVILEGED_ROLES:
        query = query.where(Post.author_id == current_user.id)

    if post_status:
        validate_post_status(post_status)
        query = query.where(Post.status == post_status)

    if search and search.strip():
        query = query.where(Post.title.ilike(f"%{search.strip()}%"))

    query = (
        query.order_by(Post.created_at.desc(), Post.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(db.scalars(query).all())


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post = get_post_or_404(db, post_id)
    ensure_can_manage_post(current_user, post)
    return post


@router.patch("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: int,
    payload: PostUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post = get_post_or_404(db, post_id)
    ensure_can_manage_post(current_user, post)
    changes = payload.model_dump(exclude_unset=True)

    # Images are managed only by the dedicated image-upload endpoint.
    changes.pop("featured_image_url", None)

    if "title" in changes:
        title = changes["title"].strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title cannot be empty.",
            )
        if title != post.title:
            post.slug = generate_unique_slug(db, title, exclude_post_id=post.id)
        post.title = title

    if "short_description" in changes:
        description = changes["short_description"]
        post.short_description = description.strip() if description else None

    if "content" in changes:
        post.content = changes["content"]

    if "status" in changes:
        new_status = changes["status"]
        validate_post_status(new_status)
        if new_status == "PUBLISHED" and not post.featured_image_url:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Upload a featured image before publishing.",
            )
        post.status = new_status
        if new_status == "PUBLISHED":
            if post.published_at is None:
                post.published_at = datetime.now(timezone.utc)
        else:
            post.published_at = None

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


@router.post("/{post_id}/image", response_model=PostResponse)
async def replace_post_image(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    image: Annotated[UploadFile, File(...)],
):
    post = get_post_or_404(db, post_id)
    ensure_can_manage_post(current_user, post)
    old_public_id = post.image_public_id
    uploaded_image = await upload_post_image(image)

    post.featured_image_url = uploaded_image["image_url"]
    post.image_public_id = uploaded_image["public_id"]

    try:
        db.commit()
        db.refresh(post)
    except Exception:
        db.rollback()
        try:
            delete_post_image(uploaded_image["public_id"])
        except Exception:
            pass
        raise

    if old_public_id and old_public_id != uploaded_image["public_id"]:
        try:
            delete_post_image(old_public_id)
        except Exception:
            # The database update has succeeded; retry cleanup separately if needed.
            pass
    return post


@router.delete("/{post_id}", response_model=PostResponse)
def move_post_to_trash(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post = get_post_or_404(db, post_id)
    ensure_can_manage_post(current_user, post)
    post.is_deleted = True

    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


@router.post("/{post_id}/restore", response_model=PostResponse)
def restore_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post = get_post_or_404(db, post_id, include_deleted=True)
    ensure_can_manage_post(current_user, post)
    if not post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Post is not in Trash.",
        )

    post.is_deleted = False
    try:
        db.commit()
        db.refresh(post)
        return post
    except Exception:
        db.rollback()
        raise


@router.delete("/{post_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator permission is required for permanent deletion.",
        )

    post = get_post_or_404(db, post_id, include_deleted=True)
    if not post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Move the post to Trash before permanently deleting it.",
        )

    public_id = post.image_public_id
    try:
        db.delete(post)
        db.commit()
    except Exception:
        db.rollback()
        raise

    # Delete the remote image only after the database deletion succeeds.
    if public_id:
        try:
            delete_post_image(public_id)
        except Exception:
            # Do not report database deletion as failed because remote cleanup failed.
            pass
    return None
