
import os
import uuid

import pytest
import requests

from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("TELUGU_FRONT_TOKEN", "")

BASE_URL = os.getenv(
    "TELUGU_FRONT_API_URL",
    "http://127.0.0.1:8000",
).rstrip("/")

API_URL = f"{BASE_URL}/api/categories"

# Set this environment variable to a valid access token.
TOKEN = os.getenv("TELUGU_FRONT_TOKEN", "")


@pytest.fixture
def client():
    """HTTP client with authentication."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    })
    return session


@pytest.fixture
def category_payload():
    """Generate unique category data for every test."""
    unique_id = uuid.uuid4().hex[:10]

    return {
        "name": f"Test Category {unique_id}",
        "slug": f"test-category-{unique_id}",
        "description": "Created by automated API tests",
        "image_url": None,
        "is_featured": False,
        "display_order": 1,
        "status": "ACTIVE",
    }


def create_category(client, payload):
    """Create a category and return its response."""
    response = client.post(API_URL, json=payload)
    assert response.status_code in (200, 201), response.text
    return response.json()


def move_to_trash(client, category_id):
    """Move a category to Trash."""
    response = client.delete(f"{API_URL}/{category_id}")
    assert response.status_code == 200, response.text
    assert response.json()["is_deleted"] is True


def test_1_create_and_get_category(client, category_payload):
    """Create a category and retrieve it by ID."""
    created = create_category(client, category_payload)
    category_id = created["id"]

    assert created["name"] == category_payload["name"]
    assert created["slug"] == category_payload["slug"]
    assert created["is_deleted"] is False

    response = client.get(f"{API_URL}/{category_id}")

    assert response.status_code == 200, response.text
    assert response.json()["id"] == category_id
    assert response.json()["name"] == category_payload["name"]


def test_2_duplicate_and_invalid_input(client, category_payload):
    """Reject duplicate values and invalid category data."""
    create_category(client, category_payload)

    # Duplicate name
    duplicate_name = {
        **category_payload,
        "slug": f"another-{uuid.uuid4().hex[:10]}",
    }
    response = client.post(API_URL, json=duplicate_name)
    assert response.status_code == 409, response.text

    # Duplicate slug: API should generate a unique slug automatically.
    duplicate_slug = {
        **category_payload,
        "name": f"Different Name {uuid.uuid4().hex[:10]}",
    }

    response = client.post(API_URL, json=duplicate_slug)

    assert response.status_code == 201, response.text

    created_category = response.json()

    assert created_category["name"] == duplicate_slug["name"]
    assert created_category["slug"] != category_payload["slug"]
    assert created_category["slug"].startswith(
        category_payload["slug"]
    )

    # Invalid status
    invalid_status = {
        **category_payload,
        "name": f"Invalid Status {uuid.uuid4().hex[:10]}",
        "slug": f"invalid-status-{uuid.uuid4().hex[:10]}",
        "status": "UNKNOWN",
    }
    response = client.post(API_URL, json=invalid_status)
    assert response.status_code == 422, response.text

    # Negative display order
    invalid_order = {
        **category_payload,
        "name": f"Invalid Order {uuid.uuid4().hex[:10]}",
        "slug": f"invalid-order-{uuid.uuid4().hex[:10]}",
        "display_order": -1,
    }
    response = client.post(API_URL, json=invalid_order)
    assert response.status_code == 422, response.text


def test_3_update_search_status_and_pagination(
    client, category_payload
):
    """Update fields and verify list filters."""
    created = create_category(client, category_payload)
    category_id = created["id"]

    updated_description = "Updated description from Pytest"

    response = client.patch(
        f"{API_URL}/{category_id}",
        json={
            "description": updated_description,
            "is_featured": True,
            "display_order": 2,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["description"] == updated_description
    assert response.json()["is_featured"] is True
    assert response.json()["display_order"] == 2

    response = client.get(
        API_URL,
        params={
            "page": 1,
            "page_size": 10,
            "search": category_payload["name"],
            "status": "ACTIVE",
            "trash": False,
        },
    )

    assert response.status_code == 200, response.text
    categories = response.json()
    assert isinstance(categories, list)
    assert any(item["id"] == category_id for item in categories)


def test_4_trash_hides_category_from_normal_list(
    client, category_payload
):
    """Trashed categories appear only in the Trash listing."""
    created = create_category(client, category_payload)
    category_id = created["id"]

    move_to_trash(client, category_id)

    normal_response = client.get(
        API_URL, params={"trash": False}
    )
    trash_response = client.get(
        API_URL, params={"trash": True}
    )

    assert normal_response.status_code == 200
    assert trash_response.status_code == 200

    normal_categories = normal_response.json()
    trashed_categories = trash_response.json()

    assert all(
        item["id"] != category_id for item in normal_categories
    )
    assert any(
        item["id"] == category_id and item["is_deleted"] is True
        for item in trashed_categories
    )


def test_5_restore_category(client, category_payload):
    """Restore a category from Trash."""
    created = create_category(client, category_payload)
    category_id = created["id"]

    move_to_trash(client, category_id)

    response = client.post(f"{API_URL}/{category_id}/restore")

    assert response.status_code == 200, response.text
    assert response.json()["is_deleted"] is False

    normal_response = client.get(
        API_URL, params={"trash": False}
    )
    assert normal_response.status_code == 200
    assert any(
        item["id"] == category_id
        for item in normal_response.json()
    )


def test_6_reorder_permanent_delete_and_auth(
    client, category_payload
):
    """Verify ordering, deletion safeguards, and authentication."""
    created = create_category(client, category_payload)
    category_id = created["id"]

    # Reorder category
    response = client.post(
        f"{API_URL}/reorder",
        json={
            "categories": [
                {"id": category_id, "display_order": 5}
            ]
        },
    )
    assert response.status_code == 200, response.text

    # Confirm permanent deletion is blocked before Trash.
    response = client.delete(
        f"{API_URL}/{category_id}/permanent"
    )
    assert response.status_code == 409, response.text

    # Move to Trash, then permanently delete.
    move_to_trash(client, category_id)

    response = client.delete(
        f"{API_URL}/{category_id}/permanent"
    )
    assert response.status_code == 204, response.text

    # Confirm the category no longer exists.
    response = client.get(f"{API_URL}/{category_id}")
    assert response.status_code == 404, response.text

    # Check unauthenticated access.
    unauthenticated = requests.get(API_URL, timeout=10)
    assert unauthenticated.status_code in (401, 403)
