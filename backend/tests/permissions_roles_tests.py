import os
import uuid
import httpx
import pytest
from dotenv import load_dotenv

from backend.tests.test_auth_helpers import get_auth_headers, get_admin_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")

if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for permissions route tests")

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
# Helpers
# ------------------------

async def _create_role(async_client: httpx.AsyncClient, headers, name: str):
    payload = {"name": name}
    resp = await async_client.post("/api/v1/permissions/create-role", json=payload, headers=headers)
    return resp

async def _get_permissions(async_client: httpx.AsyncClient, headers):
    return await async_client.get("/api/v1/permissions/get-permissions", headers=headers)

def _find_role_id(perms_body, role_name: str):
    for r in perms_body.get("permissions", []):
        if r.get("name") == role_name:
            return r.get("_id") or r.get("id")
    return None

async def _delete_role(async_client: httpx.AsyncClient, headers, role_id: str, role_name: str):
    payload = {"_id": role_id, "name": role_name}
    return await async_client.request("DELETE", "/api/v1/permissions/delete-role", json=payload, headers=headers)

async def _update_role(async_client: httpx.AsyncClient, headers, role_id: str, new_name: str):
    payload = {"_id": role_id, "name": new_name}
    return await async_client.patch("/api/v1/permissions/update-role", json=payload, headers=headers)

# ------------------------
# View route
# ------------------------

async def test_get_permissions_admin(async_client, admin_headers):
    response = await _get_permissions(async_client, admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert "permissions" in data
    assert "Success" in data or "success" in data

async def test_get_permissions_user(async_client, auth_headers):
    response = await _get_permissions(async_client, auth_headers)
    assert response.status_code == 403

# ------------------------
# create-role
# ------------------------

async def test_create_role_admin_then_cleanup(async_client, admin_headers):
    role_name = f"PyTest Role {uuid.uuid4()}"
    create_resp = await _create_role(async_client, admin_headers, role_name)
    assert create_resp.status_code in [200, 201]
    body = create_resp.json()
    assert body.get("success") is True

    perms_resp = await _get_permissions(async_client, admin_headers)
    assert perms_resp.status_code == 200
    perms_body = perms_resp.json()
    role_id = _find_role_id(perms_body, role_name)
    assert role_id is not None, "Created role not found in permissions listing"

    delete_resp = await _delete_role(async_client, admin_headers, role_id, role_name)
    assert delete_resp.status_code in [200, 204]
    delete_body = delete_resp.json()
    assert delete_body.get("success") is True

async def test_forbid_create_role_user(async_client, auth_headers):
    role_name = f"Forbidden PyTest Role {uuid.uuid4()}"
    resp = await _create_role(async_client, auth_headers, role_name)
    assert resp.status_code == 403

# ------------------------
# update-role
# ------------------------

async def test_update_role_admin_flow(async_client, admin_headers):
    original_name = f"PyTest Role {uuid.uuid4()}"
    create_resp = await _create_role(async_client, admin_headers, original_name)
    assert create_resp.status_code in [200, 201]
    assert create_resp.json().get("success") is True

    perms_resp = await _get_permissions(async_client, admin_headers)
    role_id = _find_role_id(perms_resp.json(), original_name)
    assert role_id is not None

    new_name = f"{original_name} - Updated"
    update_resp = await _update_role(async_client, admin_headers, role_id, new_name)
    assert update_resp.status_code in [200, 204]
    assert update_resp.json().get("success") is True

    delete_resp = await _delete_role(async_client, admin_headers, role_id, new_name)
    assert delete_resp.status_code in [200, 204]
    assert delete_resp.json().get("success") is True

async def test_forbid_update_role_user(async_client, auth_headers):
    resp = await _update_role(async_client, auth_headers, "000000000000000000000000", "Does Not Matter")
    assert resp.status_code == 403

# ------------------------
# delete-role
# ------------------------

async def test_delete_role_admin_flow(async_client, admin_headers):
    role_name = f"PyTest Role {uuid.uuid4()}"
    create_resp = await _create_role(async_client, admin_headers, role_name)
    assert create_resp.status_code in [200, 201]
    assert create_resp.json().get("success") is True

    perms_resp = await _get_permissions(async_client, admin_headers)
    role_id = _find_role_id(perms_resp.json(), role_name)
    assert role_id is not None

    delete_resp = await _delete_role(async_client, admin_headers, role_id, role_name)
    assert delete_resp.status_code in [200, 204]
    assert delete_resp.json().get("success") is True

async def test_forbid_delete_role_user(async_client, auth_headers):
    resp = await _delete_role(async_client, auth_headers, "000000000000000000000000", "Bogus")
    assert resp.status_code == 403

# ------------------------
# update-user-roles
# ------------------------

async def test_update_user_roles_admin(async_client, admin_headers):
    payload = {"uid": "test-user-id", "role_ids": []}
    resp = await async_client.patch("/api/v1/permissions/update-user-roles", json=payload, headers=admin_headers)
    assert resp.status_code in [200, 204]
    body = resp.json()
    assert isinstance(body, dict)
    assert "success" in body

async def test_forbid_update_user_roles_user(async_client, auth_headers):
    payload = {"uid": "test-user-id", "role_ids": []}
    resp = await async_client.patch("/api/v1/permissions/update-user-roles", json=payload, headers=auth_headers)
    assert resp.status_code == 403
