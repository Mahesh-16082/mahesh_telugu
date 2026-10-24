
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.breaking_news import BreakingNews
from app.models.post import Post
from app.models.user import User
from app.schemas.breaking_news import (
    BreakingNewsCreate,
    BreakingNewsResponse,
    BreakingNewsUpdate,
)


router = APIRouter(
    prefix="/api/breaking-news",
    tags=["Breaking News"],
)

ADMIN_ROLES = {"MASTER_ADMIN", "ADMIN"}
EDITOR_ROLES = {"MASTER_ADMIN", "ADMIN", "EDITOR"}
VALID_STATUSES = {"ACTIVE", "INACTIVE"}


def require_editor(user: User) -> None:
    if user.role not in EDITOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage breaking news.",
        )


def require_admin(user: User) -> None:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator permission is required.",
        )


def get_breaking_news_or_404(
    db: Session,
    item_id: int,
) -> BreakingNews:
    item = db.get(BreakingNews, item_id)

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Breaking news not found.",
        )

    return item


def validate_linked_post(
    db: Session,
    post_id: int | None,
) -> None:
    if post_id is None:
        return

    post = db.scalar(
        select(Post).where(
            Post.id == post_id,
            Post.is_deleted.is_(False),
            Post.status == "PUBLISHED",
        )
    )

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Linked post must exist, be published, and not be deleted.",
        )


@router.get(
    "",
    response_model=list[BreakingNewsResponse],
    summary="List breaking news",
)
def list_breaking_news(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    item_status: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=500),
):
    query = select(BreakingNews)

    if item_status is not None:
        normalized_status = item_status.strip().upper()

        if normalized_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Status must be ACTIVE or INACTIVE.",
            )

        query = query.where(
            BreakingNews.status == normalized_status
        )

    if search and search.strip():
        query = query.where(
            BreakingNews.title.ilike(f"%{search.strip()}%")
        )

    query = query.order_by(
        BreakingNews.created_at.desc(),
        BreakingNews.id.desc(),
    )

    return list(db.scalars(query).all())


@router.get(
    "/{item_id}",
    response_model=BreakingNewsResponse,
    summary="Get one breaking news item",
)
def get_breaking_news(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return get_breaking_news_or_404(db, item_id)


@router.post(
    "",
    response_model=BreakingNewsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create breaking news",
)
def create_breaking_news(
    payload: BreakingNewsCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_editor(current_user)

    validate_linked_post(db, payload.post_id)

    item = BreakingNews(**payload.model_dump())

    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create the breaking news record.",
        ) from None


@router.put(
    "/{item_id}",
    response_model=BreakingNewsResponse,
    summary="Update breaking news",
)
def update_breaking_news(
    item_id: int,
    payload: BreakingNewsUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_editor(current_user)

    item = get_breaking_news_or_404(db, item_id)
    changes = payload.model_dump(exclude_unset=True)

    if "title" in changes and changes["title"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title cannot be null.",
        )

    if "status" in changes and changes["status"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Status cannot be null.",
        )

    if "post_id" in changes:
        validate_linked_post(db, changes["post_id"])

    for field, value in changes.items():
        setattr(item, field, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update the breaking news record.",
        ) from None


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete breaking news",
)
def delete_breaking_news(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_admin(current_user)

    item = get_breaking_news_or_404(db, item_id)

    db.delete(item)
    db.commit()

    return None
