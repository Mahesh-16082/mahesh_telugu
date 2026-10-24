
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.cors.database import Base
from app.deps import get_db, get_current_user

# Import models so SQLAlchemy registers their tables.
from app.models.user import User
from app.models.post import Post
from app.models.breaking_news import BreakingNews


TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    test_user = User(
        id=999,
        first_name="Test",
        last_name="Admin",
        display_name="Test Admin",
        email="test-admin@example.com",
        role="ADMIN",
        is_active=True,
    )

    def override_get_db():
        try:
            yield db
        finally:
            pass

    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = (
        override_get_current_user
    )

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_create_breaking_news(client):
    """TC_BN_001: Create a valid breaking-news record."""

    response = client.post(
        "/api/breaking-news",
        json={
            "title": "Test Breaking News",
            "post_id": None,
            "redirect_url": None,
            "status": "ACTIVE",
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "Test Breaking News"
    assert data["status"] == "ACTIVE"
    assert data["id"] is not None
    assert data["created_at"] is not None


def test_list_breaking_news(client):
    """TC_BN_002: Create a record and retrieve it from the list."""

    create_response = client.post(
        "/api/breaking-news",
        json={
            "title": "List Test News",
            "post_id": None,
            "redirect_url": None,
            "status": "ACTIVE",
        },
    )

    assert create_response.status_code == 201
    created_id = create_response.json()["id"]

    response = client.get(
        "/api/breaking-news",
        params={"status": "ACTIVE"},
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert any(
        item["id"] == created_id
        for item in response.json()
    )


def test_update_breaking_news(client):
    """TC_BN_003: Update a headline and verify persisted values."""

    create_response = client.post(
        "/api/breaking-news",
        json={
            "title": "Original Headline",
            "post_id": None,
            "redirect_url": None,
            "status": "ACTIVE",
        },
    )

    assert create_response.status_code == 201
    item_id = create_response.json()["id"]

    response = client.put(
        f"/api/breaking-news/{item_id}",
        json={
            "title": "Updated Headline",
            "status": "INACTIVE",
        },
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated Headline"
    assert response.json()["status"] == "INACTIVE"

    get_response = client.get(
        f"/api/breaking-news/{item_id}"
    )

    assert get_response.status_code == 200
    assert get_response.json()["title"] == "Updated Headline"


def test_create_breaking_news_rejects_blank_title(client):
    """TC_BN_004: Reject a headline containing only whitespace."""

    response = client.post(
        "/api/breaking-news",
        json={
            "title": "   ",
            "post_id": None,
            "redirect_url": None,
            "status": "ACTIVE",
        },
    )

    assert response.status_code == 422


def test_get_nonexistent_breaking_news_returns_404(client):
    """TC_BN_005: Request a record that does not exist."""

    response = client.get(
        "/api/breaking-news/999999"
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Breaking news not found."
