from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.categories import Category
from app.models.post import Post
from app.models.user import User
from app.schemas.post import (
    PostBulkActionRequest,
    PostBulkActionResult,
    PostCreate,
    PostDraftCreate,
    PostPaginatedResponse,
    PostResponse,
    PostScheduleRequest,
    PostStatusCounts,
    PostUpdate,
)
from app.services.cloudinary_service import delete_post_image, upload_post_image
from app.services.post_service import (
    ADMIN_ROLES,
    PRIVILEGED_ROLES,
    VALID_STATUSES,
    create_draft as service_create_draft,
    create_post as service_create_post,
    duplicate_post as service_duplicate_post,
    ensure_admin,
    ensure_can_manage_post,
    export_posts_csv,
    generate_unique_slug,
    get_post_or_404,
    get_status_counts as service_get_status_counts,
    move_post_to_trash as service_move_to_trash,
    perform_bulk_action as service_bulk_action,
    permanently_delete_post as service_perm_delete,
    publish_post as service_publish_post,
    restore_post as service_restore_post,
    schedule_post as service_schedule_post,
    toggle_breaking as service_toggle_breaking,
    toggle_featured as service_toggle_featured,
    unpublish_post as service_unpublish_post,
    update_post as service_update_post,
    utc_now,
    validate_category_exists,
)

router = APIRouter(prefix="/api/posts", tags=["Posts"])


def build_posts_query(
    db: Session,
    current_user: User,
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    post_status: str | None = None,
    category_id: int | None = None,
    author_id: int | None = None,
    is_featured: bool | None = None,
    is_breaking_news: bool | None = None,
    trash: bool = False,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    start_date: datetime | date | None = None,
    end_date: datetime | date | None = None,
) -> PostPaginatedResponse:
    query = select(Post).where(
        Post.is_deleted.is_(True) if trash else Post.is_deleted.is_(False)
    )

    # Permission check for authors
    if current_user.role not in PRIVILEGED_ROLES:
        query = query.where(Post.author_id == current_user.id)
    elif author_id is not None:
        query = query.where(Post.author_id == author_id)

    if post_status:
        st = post_status.upper()
        if st in VALID_STATUSES:
            query = query.where(Post.status == st)

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
                Post.content.ilike(term),
                Post.slug.ilike(term),
            )
        )

    if start_date is not None:
        query = query.where(Post.created_at >= start_date)

    if end_date is not None:
        query = query.where(Post.created_at <= end_date)

    # Count matching records
    count_subquery = query.with_only_columns(func.count(Post.id)).order_by(None)
    total = db.scalar(count_subquery) or 0

    # Sorting
    sort_col = getattr(Post, sort_by, Post.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc(), Post.id.asc())
    else:
        query = query.order_by(sort_col.desc(), Post.id.desc())

    # Pagination
    offset_val = (page - 1) * page_size
    query = query.offset(offset_val).limit(page_size)

    items = list(db.scalars(query).all())
    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1

    return PostPaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# =======================================================================
# STATIC ROUTES (Must be registered before dynamic /{post_id} routes)
# =======================================================================

@router.post(
    "/drafts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft post",
)
def create_draft(
    payload: PostDraftCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_create_draft(db, payload, current_user)


@router.get(
    "/drafts",
    response_model=PostPaginatedResponse,
    summary="List draft posts with pagination and filters",
)
def list_drafts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    category_id: int | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
):
    return build_posts_query(
        db=db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        search=search,
        post_status="DRAFT",
        category_id=category_id,
        trash=False,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/published",
    response_model=PostPaginatedResponse,
    summary="List published posts with pagination and filters",
)
def list_published_posts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    category_id: int | None = Query(default=None),
    is_featured: bool | None = Query(default=None),
    is_breaking_news: bool | None = Query(default=None),
    sort_by: str = Query(default="published_at"),
    sort_order: str = Query(default="desc"),
):
    return build_posts_query(
        db=db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        search=search,
        post_status="PUBLISHED",
        category_id=category_id,
        is_featured=is_featured,
        is_breaking_news=is_breaking_news,
        trash=False,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/trash",
    response_model=PostPaginatedResponse,
    summary="List soft-deleted posts in Trash",
)
def list_trash_posts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    category_id: int | None = Query(default=None),
    sort_by: str = Query(default="deleted_at"),
    sort_order: str = Query(default="desc"),
):
    return build_posts_query(
        db=db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        search=search,
        category_id=category_id,
        trash=True,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/status-counts",
    response_model=PostStatusCounts,
    summary="Get post counts grouped by lifecycle status",
)
def get_status_counts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_get_status_counts(db, current_user)


@router.post(
    "/bulk-action",
    response_model=PostBulkActionResult,
    summary="Perform bulk actions on multiple posts",
)
def bulk_action(
    payload: PostBulkActionRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_bulk_action(db, payload, current_user)


@router.get(
    "/export",
    summary="Export filtered posts to CSV",
)
def export_posts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    author_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    is_featured: bool | None = Query(default=None),
    is_breaking_news: bool | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
):
    csv_data = export_posts_csv(
        db=db,
        current_user=current_user,
        status_filter=status,
        category_id=category_id,
        author_id=author_id,
        search=search,
        is_featured=is_featured,
        is_breaking_news=is_breaking_news,
        start_date=start_date,
        end_date=end_date,
    )
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"telugu_front_posts_{timestamp}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@router.get(
    "/check-slug",
    summary="Check availability of a slug",
)
def check_slug(
    slug: str = Query(min_length=1, max_length=300),
    exclude_post_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Post.id).where(Post.slug == slug.strip().lower())
    if exclude_post_id is not None:
        query = query.where(Post.id != exclude_post_id)
    existing = db.scalar(query)
    return {"slug": slug, "available": existing is None}


@router.get(
    "/recent",
    response_model=list[PostResponse],
    summary="Get recent posts for the dashboard",
)
def get_recent_posts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=5, ge=1, le=20),
):
    query = select(Post).where(Post.is_deleted.is_(False))
    if current_user.role not in PRIVILEGED_ROLES:
        query = query.where(Post.author_id == current_user.id)
    query = query.order_by(Post.created_at.desc(), Post.id.desc()).limit(limit)
    return list(db.scalars(query).all())


@router.post(
    "/upload-image",
    summary="Upload a post featured image to Cloudinary",
)
async def upload_image(
    image: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return await upload_post_image(image)


@router.get(
    "/slug/{slug}",
    response_model=PostResponse,
    summary="Get post details by unique slug",
)
def get_post_by_slug(
    slug: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    query = select(Post).where(Post.slug == slug)
    post = db.scalar(query)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    if post.is_deleted and current_user.role not in PRIVILEGED_ROLES and post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    return post


# =======================================================================
# GENERAL CRUD ROUTES
# =======================================================================

@router.post(
    "",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new post",
)
def create_post(
    payload: PostCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_create_post(db, payload, current_user)


@router.get(
    "",
    response_model=PostPaginatedResponse,
    summary="List posts with pagination, filters, and search",
)
def list_posts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    post_status: str | None = Query(default=None, alias="status"),
    category_id: int | None = Query(default=None),
    author_id: int | None = Query(default=None),
    is_featured: bool | None = Query(default=None),
    is_breaking_news: bool | None = Query(default=None),
    trash: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=255),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    start_date: datetime | date | None = Query(default=None),
    end_date: datetime | date | None = Query(default=None),
):
    return build_posts_query(
        db=db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        search=search,
        post_status=post_status,
        category_id=category_id,
        author_id=author_id,
        is_featured=is_featured,
        is_breaking_news=is_breaking_news,
        trash=trash,
        sort_by=sort_by,
        sort_order=sort_order,
        start_date=start_date,
        end_date=end_date,
    )


# =======================================================================
# DRAFT EDIT ROUTE
# =======================================================================

@router.patch(
    "/drafts/{post_id}",
    response_model=PostResponse,
    summary="Edit an existing draft",
)
def update_draft(
    post_id: int,
    payload: PostUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post = get_post_or_404(db, post_id, include_deleted=False)
    if post.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post is not in DRAFT status.",
        )
    return service_update_post(db, post_id, payload, current_user, is_put=False)


# =======================================================================
# ID-SPECIFIC ROUTES
# =======================================================================

@router.get(
    "/{post_id}",
    response_model=PostResponse,
    summary="Retrieve complete details for one post",
)
def get_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    post = get_post_or_404(db, post_id, include_deleted=True)
    ensure_can_manage_post(current_user, post)
    return post


@router.put(
    "/{post_id}",
    response_model=PostResponse,
    summary="Full update of a post",
)
def full_update_post(
    post_id: int,
    payload: PostUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_update_post(db, post_id, payload, current_user, is_put=True)


@router.patch(
    "/{post_id}",
    response_model=PostResponse,
    summary="Partial update of a post",
)
def partial_update_post(
    post_id: int,
    payload: PostUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_update_post(db, post_id, payload, current_user, is_put=False)


@router.delete(
    "/{post_id}",
    response_model=PostResponse,
    summary="Move a post to Trash (soft-delete)",
)
def delete_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_move_to_trash(db, post_id, current_user)


@router.post(
    "/{post_id}/publish",
    response_model=PostResponse,
    summary="Publish a post or draft",
)
def publish_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_publish_post(db, post_id, current_user)


@router.post(
    "/{post_id}/unpublish",
    response_model=PostResponse,
    summary="Unpublish a post (revert to DRAFT)",
)
def unpublish_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_unpublish_post(db, post_id, current_user)


@router.post(
    "/{post_id}/schedule",
    response_model=PostResponse,
    summary="Schedule a post for future publication",
)
def schedule_post(
    post_id: int,
    payload: PostScheduleRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_schedule_post(db, post_id, payload.scheduled_at, current_user)


@router.post(
    "/{post_id}/restore",
    response_model=PostResponse,
    summary="Restore a post from Trash",
)
def restore_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_restore_post(db, post_id, current_user)


@router.delete(
    "/{post_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a post from database",
)
def permanent_delete_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    image_public_id = service_perm_delete(db, post_id, current_user)
    if image_public_id:
        try:
            delete_post_image(image_public_id)
        except Exception:
            pass
    return None


@router.post(
    "/{post_id}/duplicate",
    response_model=PostResponse,
    summary="Duplicate an existing post",
)
def duplicate_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_duplicate_post(db, post_id, current_user)


@router.post(
    "/{post_id}/toggle-featured",
    response_model=PostResponse,
    summary="Toggle featured flag on a post",
)
def toggle_featured(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_toggle_featured(db, post_id, current_user)


@router.post(
    "/{post_id}/toggle-breaking",
    response_model=PostResponse,
    summary="Toggle breaking news flag on a post",
)
def toggle_breaking(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return service_toggle_breaking(db, post_id, current_user)


@router.post(
    "/{post_id}/image",
    response_model=PostResponse,
    summary="Upload or replace post featured image",
)
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

    post.featured_image = uploaded_image["image_url"]
    post.featured_image_url = uploaded_image["image_url"]
    post.image_public_id = uploaded_image["public_id"]
    post.updated_at = utc_now()

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
            pass

    return post
