import os
import uuid
import httpx
import pytest
from dotenv import load_dotenv

from backend.tests.test_auth_helpers import get_auth_headers, get_admin_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for header/footer route tests")

pytestmark = pytest.mark.anyio("asyncio")

@pytest.fixture
def anyio_backend():
    return "asyncio"

_AUTH_HEADERS = None
_ADMIN_HEADERS = None

@pytest.fixture(scope="session")
def auth_headers():
    global _AUTH_HEADERS
    if _AUTH_HEADERS is None:
        _AUTH_HEADERS = get_auth_headers()
    return _AUTH_HEADERS

@pytest.fixture(scope="session")
def admin_headers():
    global _ADMIN_HEADERS
    if _ADMIN_HEADERS is None:
        _ADMIN_HEADERS = get_admin_headers()
    return _ADMIN_HEADERS

@pytest.fixture
async def async_client():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        yield client

# ------------------------
# Public GET routes
# ------------------------

async def test_get_header_public(async_client):
    resp = await async_client.get("/api/v1/header")
    assert resp.status_code in (200, 404)

async def test_get_footer_public(async_client):
    resp = await async_client.get("/api/v1/footer")
    assert resp.status_code in (200, 404)

# ------------------------
# Header flows
# ------------------------

async def test_add_update_delete_header_link_admin(async_client, admin_headers):
    name = f"HeaderLink-{uuid.uuid4()}"
    payload = {"title": name, "russian_title": name, "url": "https://example.com", "visible": True}
    create = await async_client.post("/api/v1/header/items/links", json=payload, headers=admin_headers)
    assert create.status_code in (200, 201)
    assert create.json()["success"]

    update_payload = {"title": name, "russian_title": name, "url": "https://changed.com", "visible": True}
    update = await async_client.put(f"/api/v1/header/items/edit/{name}", json=update_payload, headers=admin_headers)
    assert update.status_code in (200, 204)
    assert update.json()["success"]

    delete = await async_client.request("DELETE", f"/api/v1/header/{name}", headers=admin_headers)
    assert delete.status_code in (200, 204)
    assert delete.json()["success"]

async def test_forbid_add_header_link_user(async_client, auth_headers):
    name = f"HeaderLink-{uuid.uuid4()}"
    payload = {"title": name, "russian_title": name, "url": "https://example.com"}
    resp = await async_client.post("/api/v1/header/items/links", json=payload, headers=auth_headers)
    assert resp.status_code == 403

async def test_change_header_visibility_admin(async_client, admin_headers):
    name = f"HeaderLink-{uuid.uuid4()}"
    payload = {"title": name, "russian_title": name, "url": "https://example.com"}
    create = await async_client.post("/api/v1/header/items/links", json=payload, headers=admin_headers)
    assert create.status_code in (200, 201)
    assert create.json()["success"]

    vis = await async_client.put(f"/api/v1/header/{name}/visibility", json={"visible": False}, headers=admin_headers)
    assert vis.status_code in (200, 204)
    assert vis.json()["success"]

    delete = await async_client.request("DELETE", f"/api/v1/header/{name}", headers=admin_headers)
    assert delete.status_code in (200, 204)

async def test_forbid_change_header_visibility_user(async_client, auth_headers):
    resp = await async_client.put("/api/v1/header/some-title/visibility", json={"visible": False}, headers=auth_headers)
    assert resp.status_code == 403

# ------------------------
# Footer flows
# ------------------------

async def test_add_update_delete_footer_item_admin(async_client, admin_headers):
    name = f"Footer-{uuid.uuid4()}"
    payload = {
        "title": name,
        "russian_title": name,
        "items": [{"title": "Sub", "russian_title": "SubRU", "url": "https://sub.com"}],
        "visible": True
    }
    create = await async_client.post("/api/v1/footer/items", json=payload, headers=admin_headers)

    assert create.status_code in (200, 201)
    assert create.json()["success"]

    update_payload = {
        "title": name,
        "russian_title": name,
        "items": [{"title": "SubChanged", "russian_title": "SubRU", "url": "https://changed.com"}],
        "visible": True
    }
    update = await async_client.put(f"/api/v1/footer/items/edit/{name}", json=update_payload, headers=admin_headers)

    assert update.status_code in (200, 204)
    assert update.json()["success"]

    delete = await async_client.request("DELETE", f"/api/v1/footer/{name}", headers=admin_headers)

    assert delete.status_code in (200, 204)
    assert delete.json()["success"]

async def test_forbid_add_footer_item_user(async_client, auth_headers):
    name = f"Footer-{uuid.uuid4()}"
    payload = {
        "title": name,
        "russian_title": name,
        "items": [{"title": "Sub", "russian_title": "SubRU", "url": "https://sub.com"}]
    }
    resp = await async_client.post("/api/v1/footer/items", json=payload, headers=auth_headers)
    assert resp.status_code == 403

async def test_change_footer_visibility_admin(async_client, admin_headers):
    name = f"Footer-{uuid.uuid4()}"
    payload = {
        "title": name,
        "russian_title": name,
        "items": [{"title": "Sub", "russian_title": "SubRU", "url": "https://sub.com"}]
    }
    create = await async_client.post("/api/v1/footer/items", json=payload, headers=admin_headers)
    assert create.status_code in (200, 201)
    assert create.json()["success"]

    vis = await async_client.put(f"/api/v1/footer/{name}/visibility", json={"visible": False}, headers=admin_headers)
    assert vis.status_code in (200, 204)
    assert vis.json()["success"]

    delete = await async_client.request("DELETE", f"/api/v1/footer/{name}", headers=admin_headers)
    assert delete.status_code in (200, 204)

async def test_forbid_change_footer_visibility_user(async_client, auth_headers):
    resp = await async_client.put("/api/v1/footer/some-title/visibility", json={"visible": False}, headers=auth_headers)
    assert resp.status_code == 403
