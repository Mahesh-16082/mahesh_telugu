import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.cors.database import SessionLocal
from app.cors.security import create_access_token
from app.main import app
from app.models.categories import Category
from app.models.post import Post
from app.models.user import User

client = TestClient(app)


def get_or_create_user(email: str, role: str, display_name: str) -> User:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                role=role,
                display_name=display_name,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user


def get_or_create_category(name: str, slug: str) -> Category:
    with SessionLocal() as db:
        cat = db.scalar(select(Category).where((Category.name == name) | (Category.slug == slug)))
        if cat is None:
            cat = Category(
                name=name,
                slug=slug,
                status="ACTIVE",
                is_deleted=False,
            )
            db.add(cat)
            db.commit()
            db.refresh(cat)
        return cat


@pytest.fixture(scope="session")
def admin_user():
    return get_or_create_user("admin_test@telugufront.com", "MASTER_ADMIN", "Admin Tester")


@pytest.fixture(scope="session")
def author_user_1():
    return get_or_create_user("author1_test@telugufront.com", "USER", "Author One")


@pytest.fixture(scope="session")
def author_user_2():
    return get_or_create_user("author2_test@telugufront.com", "USER", "Author Two")


@pytest.fixture(scope="session")
def test_category():
    return get_or_create_category("Test Category General", f"test-cat-{uuid.uuid4().hex[:6]}")


@pytest.fixture(scope="session")
def admin_token(admin_user):
    return create_access_token(admin_user.email, admin_user.role)


@pytest.fixture(scope="session")
def author1_token(author_user_1):
    return create_access_token(author_user_1.email, author_user_1.role)


@pytest.fixture(scope="session")
def author2_token(author_user_2):
    return create_access_token(author_user_2.email, author_user_2.role)


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# =====================================================================
# 1. SECURITY & AUTHENTICATION TESTS
# =====================================================================

def test_unauthenticated_requests_rejected():
    res = client.get("/api/posts")
    assert res.status_code == 401

    res = client.post("/api/posts", json={"title": "Unauthorized"})
    assert res.status_code == 401

    res = client.post("/api/posts/drafts", json={"title": "Unauthorized"})
    assert res.status_code == 401

    res = client.get("/api/posts/status-counts")
    assert res.status_code == 401


def test_cross_user_modification_forbidden(author1_token, author2_token):
    # Author 1 creates a draft
    create_res = client.post(
        "/api/posts/drafts",
        headers=auth_header(author1_token),
        json={"title": "Author 1 Post for Security Test"},
    )
    assert create_res.status_code == 201
    post_id = create_res.json()["id"]

    # Author 2 attempts to update Author 1's post -> 403 Forbidden
    patch_res = client.patch(
        f"/api/posts/{post_id}",
        headers=auth_header(author2_token),
        json={"title": "Hacked by Author 2"},
    )
    assert patch_res.status_code == 403

    # Author 2 attempts to delete Author 1's post -> 403 Forbidden
    del_res = client.delete(
        f"/api/posts/{post_id}",
        headers=auth_header(author2_token),
    )
    assert del_res.status_code == 403


# =====================================================================
# 2. CRUD & SLUG HANDLING TESTS
# =====================================================================

def test_create_and_retrieve_post(admin_token, test_category):
    title = f"Breaking News Story {uuid.uuid4().hex[:6]}"
    payload = {
        "title": title,
        "summary": "This is a brief summary of the story",
        "content": "<p>Full content of the article goes here.</p>",
        "category_id": test_category.id,
        "is_featured": True,
        "is_breaking_news": True,
        "status": "DRAFT",
    }
    res = client.post("/api/posts", headers=auth_header(admin_token), json=payload)
    assert res.status_code == 201
    data = res.json()
    post_id = data["id"]
    assert data["title"] == title
    assert data["summary"] == payload["summary"]
    assert data["is_featured"] is True
    assert data["is_breaking_news"] is True
    assert data["category_id"] == test_category.id
    assert data["category"]["name"] == test_category.name
    assert "slug" in data and len(data["slug"]) > 0

    # Retrieve by ID
    get_res = client.get(f"/api/posts/{post_id}", headers=auth_header(admin_token))
    assert get_res.status_code == 200
    assert get_res.json()["id"] == post_id

    # Retrieve by Slug
    slug_res = client.get(f"/api/posts/slug/{data['slug']}", headers=auth_header(admin_token))
    assert slug_res.status_code == 200
    assert slug_res.json()["id"] == post_id


def test_create_draft_minimal_fields(author1_token):
    res = client.post(
        "/api/posts/drafts",
        headers=auth_header(author1_token),
        json={"title": "Quick Draft Idea"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Quick Draft Idea"
    assert data["status"] == "DRAFT"
    assert data["published_at"] is None


def test_reject_invalid_data(admin_token):
    # Empty title
    res = client.post(
        "/api/posts",
        headers=auth_header(admin_token),
        json={"title": "   "},
    )
    assert res.status_code == 422

    # Non-existent category
    res = client.post(
        "/api/posts",
        headers=auth_header(admin_token),
        json={"title": "Test Title", "category_id": 999999},
    )
    assert res.status_code == 400


def test_duplicate_title_generates_unique_slugs(admin_token):
    same_title = f"Unique Title Test {uuid.uuid4().hex[:6]}"
    res1 = client.post("/api/posts", headers=auth_header(admin_token), json={"title": same_title})
    assert res1.status_code == 201
    slug1 = res1.json()["slug"]

    res2 = client.post("/api/posts", headers=auth_header(admin_token), json={"title": same_title})
    assert res2.status_code == 201
    slug2 = res2.json()["slug"]

    assert slug1 != slug2
    assert slug2.startswith(slug1)


def test_check_slug_endpoint(admin_token):
    res = client.get("/api/posts/check-slug?slug=unlikely-existing-slug-xyz123", headers=auth_header(admin_token))
    assert res.status_code == 200
    assert res.json()["available"] is True


def test_update_and_partial_update(admin_token):
    create_res = client.post(
        "/api/posts",
        headers=auth_header(admin_token),
        json={"title": "Post To Update", "summary": "Old Summary"},
    )
    post_id = create_res.json()["id"]

    # PATCH partial update
    patch_res = client.patch(
        f"/api/posts/{post_id}",
        headers=auth_header(admin_token),
        json={"summary": "New Updated Summary"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["summary"] == "New Updated Summary"
    assert patch_res.json()["title"] == "Post To Update"

    # PUT full update
    put_res = client.put(
        f"/api/posts/{post_id}",
        headers=auth_header(admin_token),
        json={"title": "Completely Updated Title", "summary": "New Put Summary"},
    )
    assert put_res.status_code == 200
    assert put_res.json()["title"] == "Completely Updated Title"


# =====================================================================
# 3. PUBLISHING, UNPUBLISHING & SCHEDULING TESTS
# =====================================================================

def test_publish_and_unpublish_lifecycle(admin_token):
    create_res = client.post(
        "/api/posts/drafts",
        headers=auth_header(admin_token),
        json={"title": "Post to Publish Lifecycle"},
    )
    post_id = create_res.json()["id"]
    assert create_res.json()["status"] == "DRAFT"

    # Publish
    pub_res = client.post(f"/api/posts/{post_id}/publish", headers=auth_header(admin_token))
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"
    assert pub_res.json()["published_at"] is not None

    # Unpublish
    unpub_res = client.post(f"/api/posts/{post_id}/unpublish", headers=auth_header(admin_token))
    assert unpub_res.status_code == 200
    assert unpub_res.json()["status"] == "DRAFT"
    assert unpub_res.json()["published_at"] is None


def test_schedule_post(admin_token):
    create_res = client.post(
        "/api/posts/drafts",
        headers=auth_header(admin_token),
        json={"title": "Post to Schedule"},
    )
    post_id = create_res.json()["id"]

    # Past date should fail
    past_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    past_res = client.post(
        f"/api/posts/{post_id}/schedule",
        headers=auth_header(admin_token),
        json={"scheduled_at": past_time},
    )
    assert past_res.status_code == 422

    # Future date succeeds
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    sched_res = client.post(
        f"/api/posts/{post_id}/schedule",
        headers=auth_header(admin_token),
        json={"scheduled_at": future_time},
    )
    assert sched_res.status_code == 200
    assert sched_res.json()["status"] == "SCHEDULED"
    assert sched_res.json()["scheduled_at"] is not None


# =====================================================================
# 4. TRASH, RESTORE & PERMANENT DELETE TESTS
# =====================================================================

def test_trash_restore_and_permanent_delete(admin_token, author1_token):
    create_res = client.post(
        "/api/posts/drafts",
        headers=auth_header(admin_token),
        json={"title": "Post for Trash Test"},
    )
    post_id = create_res.json()["id"]

    # Move to trash
    del_res = client.delete(f"/api/posts/{post_id}", headers=auth_header(admin_token))
    assert del_res.status_code == 200
    assert del_res.json()["is_deleted"] is True

    # Trashed post should not appear in regular list
    list_res = client.get("/api/posts", headers=auth_header(admin_token))
    assert list_res.status_code == 200
    active_ids = [p["id"] for p in list_res.json()["items"]]
    assert post_id not in active_ids

    # Appears in /api/posts/trash
    trash_res = client.get("/api/posts/trash", headers=auth_header(admin_token))
    assert trash_res.status_code == 200
    trash_ids = [p["id"] for p in trash_res.json()["items"]]
    assert post_id in trash_ids

    # Restore post
    rest_res = client.post(f"/api/posts/{post_id}/restore", headers=auth_header(admin_token))
    assert rest_res.status_code == 200
    assert rest_res.json()["is_deleted"] is False

    # Restoring non-trashed post should 409
    dup_rest = client.post(f"/api/posts/{post_id}/restore", headers=auth_header(admin_token))
    assert dup_rest.status_code == 409

    # Delete again to test permanent deletion
    client.delete(f"/api/posts/{post_id}", headers=auth_header(admin_token))

    # Author cannot permanently delete -> 403 Forbidden
    auth_perm = client.delete(f"/api/posts/{post_id}/permanent", headers=auth_header(author1_token))
    assert auth_perm.status_code == 403

    # Admin permanently deletes -> 204 No Content
    admin_perm = client.delete(f"/api/posts/{post_id}/permanent", headers=auth_header(admin_token))
    assert admin_perm.status_code == 204

    # Post no longer exists
    not_found = client.get(f"/api/posts/{post_id}", headers=auth_header(admin_token))
    assert not_found.status_code == 404


# =====================================================================
# 5. BULK ACTIONS & EXPORT TESTS
# =====================================================================

def test_bulk_actions(admin_token, test_category):
    # Create 3 posts
    p1 = client.post("/api/posts/drafts", headers=auth_header(admin_token), json={"title": "Bulk Post 1"}).json()["id"]
    p2 = client.post("/api/posts/drafts", headers=auth_header(admin_token), json={"title": "Bulk Post 2"}).json()["id"]
    p3 = client.post("/api/posts/drafts", headers=auth_header(admin_token), json={"title": "Bulk Post 3"}).json()["id"]

    # Bulk publish
    bulk_pub = client.post(
        "/api/posts/bulk-action",
        headers=auth_header(admin_token),
        json={"action": "publish", "post_ids": [p1, p2, p3]},
    )
    assert bulk_pub.status_code == 200
    assert bulk_pub.json()["success_count"] == 3

    # Bulk trash
    bulk_trash = client.post(
        "/api/posts/bulk-action",
        headers=auth_header(admin_token),
        json={"action": "trash", "post_ids": [p1, p2]},
    )
    assert bulk_trash.status_code == 200
    assert bulk_trash.json()["success_count"] == 2

    # Bulk restore
    bulk_restore = client.post(
        "/api/posts/bulk-action",
        headers=auth_header(admin_token),
        json={"action": "restore", "post_ids": [p1, p2]},
    )
    assert bulk_restore.status_code == 200
    assert bulk_restore.json()["success_count"] == 2


def test_export_posts_csv(admin_token):
    res = client.get("/api/posts/export", headers=auth_header(admin_token))
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "Title" in res.text
    assert "Slug" in res.text
    assert "Status" in res.text


# =====================================================================
# 6. STATUS COUNTS, RECENT, AND TOGGLES
# =====================================================================

def test_status_counts(admin_token):
    res = client.get("/api/posts/status-counts", headers=auth_header(admin_token))
    assert res.status_code == 200
    counts = res.json()
    assert "all" in counts
    assert "published" in counts
    assert "draft" in counts
    assert "trash" in counts


def test_toggle_featured_and_breaking(admin_token):
    post = client.post(
        "/api/posts/drafts",
        headers=auth_header(admin_token),
        json={"title": "Toggle Post Test"},
    ).json()
    post_id = post["id"]
    assert post["is_featured"] is False
    assert post["is_breaking_news"] is False

    # Toggle featured
    f_res = client.post(f"/api/posts/{post_id}/toggle-featured", headers=auth_header(admin_token))
    assert f_res.status_code == 200
    assert f_res.json()["is_featured"] is True

    # Toggle breaking
    b_res = client.post(f"/api/posts/{post_id}/toggle-breaking", headers=auth_header(admin_token))
    assert b_res.status_code == 200
    assert b_res.json()["is_breaking_news"] is True


def test_duplicate_post(admin_token):
    orig = client.post(
        "/api/posts/drafts",
        headers=auth_header(admin_token),
        json={"title": "Original Post For Duplicate"},
    ).json()
    post_id = orig["id"]

    dup_res = client.post(f"/api/posts/{post_id}/duplicate", headers=auth_header(admin_token))
    assert dup_res.status_code == 200
    dup = dup_res.json()
    assert dup["title"] == "Original Post For Duplicate (Copy)"
    assert dup["slug"] != orig["slug"]
    assert dup["id"] != post_id
    assert dup["status"] == "DRAFT"


def test_search_and_filtering(admin_token, test_category):
    tag = uuid.uuid4().hex[:8]
    p1 = client.post(
        "/api/posts",
        headers=auth_header(admin_token),
        json={
            "title": f"Special Search Keyword {tag}",
            "summary": "Special summary content",
            "content": "Special body content",
            "category_id": test_category.id,
            "status": "PUBLISHED",
        },
    ).json()

    # Search by keyword
    search_res = client.get(f"/api/posts?search={tag}", headers=auth_header(admin_token))
    assert search_res.status_code == 200
    items = search_res.json()["items"]
    assert any(p["id"] == p1["id"] for p in items)

    # Filter by category
    cat_res = client.get(f"/api/posts?category_id={test_category.id}", headers=auth_header(admin_token))
    assert cat_res.status_code == 200
    assert any(p["id"] == p1["id"] for p in cat_res.json()["items"])

    # Filter by status
    stat_res = client.get("/api/posts?status=PUBLISHED", headers=auth_header(admin_token))
    assert stat_res.status_code == 200
    for p in stat_res.json()["items"]:
        assert p["status"] == "PUBLISHED"


def test_pagination_and_sorting(admin_token):
    res = client.get("/api/posts?page=1&page_size=2&sort_by=created_at&sort_order=desc", headers=auth_header(admin_token))
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert "total" in data
    assert "total_pages" in data
    assert len(data["items"]) <= 2


def test_draft_edit_endpoint(admin_token):
    draft = client.post(
        "/api/posts/drafts",
        headers=auth_header(admin_token),
        json={"title": "Draft for Dedicated Edit Endpoint"},
    ).json()
    post_id = draft["id"]

    patch_res = client.patch(
        f"/api/posts/drafts/{post_id}",
        headers=auth_header(admin_token),
        json={"title": "Draft Title Modified via Dedicated Route"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Draft Title Modified via Dedicated Route"

    # Cannot edit a published post via drafts endpoint
    client.post(f"/api/posts/{post_id}/publish", headers=auth_header(admin_token))
    err_res = client.patch(
        f"/api/posts/drafts/{post_id}",
        headers=auth_header(admin_token),
        json={"title": "Should Fail Because Published"},
    )
    assert err_res.status_code == 400


def test_recent_posts_endpoint(admin_token):
    res = client.get("/api/posts/recent?limit=5", headers=auth_header(admin_token))
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) <= 5

