
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.categories import Category
from app.models.user import User
from app.schemas.categories import (
    CategoryCreate,
    CategoryResponse,
    CategoryReorderRequest,
    CategoryUpdate,
)


router = APIRouter(prefix="/api/categories", tags=["Categories"])

ADMIN_ROLES = {"MASTER_ADMIN", "ADMIN"}
EDITOR_ROLES = {"MASTER_ADMIN", "ADMIN", "EDITOR"}
VALID_STATUSES = {"ACTIVE", "INACTIVE"}


def make_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug or "category"


def generate_unique_slug(
    db: Session,
    value: str,
    exclude_category_id: int | None = None,
) -> str:
    base_slug = make_slug(value)
    candidate = base_slug
    counter = 2

    while True:
        query = select(Category.id).where(Category.slug == candidate)

        if exclude_category_id is not None:
            query = query.where(Category.id != exclude_category_id)

        if db.scalar(query) is None:
            return candidate

        candidate = f"{base_slug}-{counter}"
        counter += 1


def get_category_or_404(
    db: Session,
    category_id: int,
    include_deleted: bool = False,
) -> Category:
    query = select(Category).where(Category.id == category_id)

    if not include_deleted:
        query = query.where(Category.is_deleted.is_(False))

    category = db.scalar(query)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    return category


def require_editor(user: User) -> None:
    if user.role not in EDITOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage categories.",
        )


def require_admin(user: User) -> None:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator permission is required.",
        )


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_editor(current_user)

    name = payload.name.strip()

    existing = db.scalar(
        select(Category.id).where(
            func.lower(Category.name) == name.lower()
        )
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name already exists.",
        )

    data = payload.model_dump()
    requested_slug = data.pop("slug", None)
    slug_source = requested_slug.strip() if requested_slug else name

    category = Category(
        **data,
        slug=generate_unique_slug(db, slug_source),
    )

    try:
        db.add(category)
        db.commit()
        db.refresh(category)
        return category
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name or slug already exists.",
        )


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    category_status: str | None = Query(default=None, alias="status"),
    trash: bool = False,
):
    query = select(Category).where(
        Category.is_deleted.is_(True)
        if trash
        else Category.is_deleted.is_(False)
    )

    if category_status:
        if category_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Status must be ACTIVE or INACTIVE.",
            )
        query = query.where(Category.status == category_status)

    if search and search.strip():
        query = query.where(
            Category.name.ilike(f"%{search.strip()}%")
        )

    query = query.order_by(
        Category.display_order.asc(),
        Category.created_at.desc(),
        Category.id.desc(),
    )
    query = query.offset((page - 1) * page_size).limit(page_size)

    return list(db.scalars(query).all())


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return get_category_or_404(db, category_id)


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_editor(current_user)

    category = get_category_or_404(db, category_id)
    changes = payload.model_dump(exclude_unset=True)

    if "name" in changes:
        name = changes["name"].strip()

        duplicate = db.scalar(
            select(Category.id).where(
                func.lower(Category.name) == name.lower(),
                Category.id != category_id,
            )
        )

        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A category with this name already exists.",
            )

        if name != category.name:
            category.slug = generate_unique_slug(
                db,
                name,
                exclude_category_id=category.id,
            )

        category.name = name

    if "slug" in changes and changes["slug"] is not None:
        requested_slug = changes["slug"].strip()

        if not requested_slug:
            requested_slug = category.name

        category.slug = generate_unique_slug(
            db,
            requested_slug,
            exclude_category_id=category.id,
        )

    for field in (
        "description",
        "image_url",
        "is_featured",
        "display_order",
        "status",
    ):
        if field in changes:
            setattr(category, field, changes[field])

    try:
        db.commit()
        db.refresh(category)
        return category
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name or slug already exists.",
        )


@router.delete("/{category_id}", response_model=CategoryResponse)
def move_category_to_trash(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_editor(current_user)

    category = get_category_or_404(db, category_id)
    category.is_deleted = True

    db.commit()
    db.refresh(category)
    return category



@router.post("/{category_id}/restore", response_model=CategoryResponse)
def restore_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_editor(current_user)

    category = get_category_or_404(
        db, category_id, include_deleted=True
    )

    if not category.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category is not in Trash.",
        )

    category.is_deleted = False
    db.commit()
    db.refresh(category)
    return category


@router.delete(
    "/{category_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
)
def permanently_delete_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_admin(current_user)

    category = get_category_or_404(
        db, category_id, include_deleted=True
    )

    if not category.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Move the category to Trash before deleting it permanently.",
        )

    db.delete(category)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This category is still referenced by other records.",
        )

    return None


@router.post("/reorder")
def reorder_categories(
    payload: CategoryReorderRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    require_editor(current_user)

    category_ids = [item.id for item in payload.categories]

    if len(category_ids) != len(set(category_ids)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Duplicate category IDs are not allowed.",
        )

    categories = list(
        db.scalars(
            select(Category).where(
                Category.id.in_(category_ids),
                Category.is_deleted.is_(False),
            )
        ).all()
    )

    if len(categories) != len(category_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more categories were not found.",
        )

    order_by_id = {
        item.id: item.display_order
        for item in payload.categories
    }

    try:
        for category in categories:
            category.display_order = order_by_id[category.id]

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Categories reordered successfully."}
