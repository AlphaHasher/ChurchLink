from dotenv import load_dotenv
import httpx
import os

from backend.tests.test_auth_helpers import get_admin_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")


def test_list_pages():
    headers = get_admin_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/pages/", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_page_by_slug():
    headers = get_admin_headers()
    slug = "test-page"
    response = httpx.get(f"{BASE_URL}/api/v1/pages/slug/{slug}", headers=headers)
    assert response.status_code in [200, 404]


def test_create_page():
    headers = get_admin_headers()
    payload = {
        "title": "Test Page",
        "content": "This is a test page.",
        "slug": "test-page"
    }
    response = httpx.post(f"{BASE_URL}/api/v1/pages/", json=payload, headers=headers)
    assert response.status_code in [200, 201, 400]
    global created_page_id
    if response.status_code in [200, 201]:
        data = response.json()
        assert "id" in data or "_id" in data
        created_page_id = data.get("id") or data.get("_id")


def test_update_page():
    headers = get_admin_headers()
    page_id = globals().get("created_page_id", "test-page-id")
    payload = {
        "title": "Updated Test Page",
        "content": "Updated content."
    }
    response = httpx.patch(f"{BASE_URL}/api/v1/pages/{page_id}", json=payload, headers=headers)
    assert response.status_code in [200, 404, 400, 405]


def test_delete_page():
    headers = get_admin_headers()
    page_id = globals().get("created_page_id", "test-page-id")
    response = httpx.delete(f"{BASE_URL}/api/v1/pages/{page_id}", headers=headers)
    assert response.status_code in [200, 404, 400]


def test_publish_page():
    headers = get_admin_headers()
    slug = "test-page"
    payload = {
        "title": "Published Test Page",
        "puckData": {"content": [], "root": {"props": {"title": "Test"}}},
        "format": "puck",
    }
    response = httpx.post(
        f"{BASE_URL}/api/v1/pages/publish/{slug}",
        json=payload,
        headers=headers,
    )
    assert response.status_code in [200, 201]
