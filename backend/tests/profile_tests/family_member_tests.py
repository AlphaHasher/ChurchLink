# backend/tests/family_member_tests.py

import os
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from dotenv import load_dotenv

from backend.tests.test_auth_helpers import get_auth_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for family member tests")

pytestmark = pytest.mark.anyio("asyncio")


@pytest.fixture
def anyio_backend():
    return "asyncio"


_AUTH_HEADERS = None


@pytest.fixture(scope="session")
def auth_headers():
    """
    Reuse the same auth header pattern used in profile/contact tests so we
    don't hammer Firebase on every single test.
    """
    global _AUTH_HEADERS
    if _AUTH_HEADERS is None:
        _AUTH_HEADERS = get_auth_headers()
    return _AUTH_HEADERS


@pytest.fixture
async def async_client():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        yield client


# ------------------------
# Helpers
# ------------------------


def _make_birthdate_years_ago(years: int = 10) -> str:
    """
    Return an ISO-8601 datetime string some number of years in the past.
    PersonCreate.date_of_birth is a datetime field, so this shape is valid.
    """
    when = datetime.now(timezone.utc) - timedelta(days=365 * years)
    return when.isoformat()


def _make_valid_family_member_payload(**overrides) -> dict:
    """
    Build a complete PersonCreate payload.

    PersonCreate:
      - first_name: str (1–50 chars)
      - last_name: str  (1–50 chars)
      - gender: "M" | "F"
      - date_of_birth: datetime (as ISO string over the wire)
    """
    base = {
        "first_name": "Family",
        "last_name": "Member",
        "gender": "M",
        "date_of_birth": _make_birthdate_years_ago(10),
    }
    base.update(overrides)
    return base


async def _list_family_members(async_client: httpx.AsyncClient, headers):
    return await async_client.get("/api/v1/users/all-family-members", headers=headers)


async def _add_family_member(async_client: httpx.AsyncClient, headers, payload: dict):
    # POST /users/add-family-member returns { success, family_member } on success.
    return await async_client.post("/api/v1/users/add-family-member", json=payload, headers=headers)


async def _get_family_member(async_client: httpx.AsyncClient, headers, member_id: str):
    return await async_client.get(f"/api/v1/users/family-member/{member_id}", headers=headers)


async def _update_family_member(async_client: httpx.AsyncClient, headers, payload: dict):
    # PATCH /users/family-member expects PersonUpdateRequest (id + optional fields).
    return await async_client.patch("/api/v1/users/family-member", json=payload, headers=headers)


async def _delete_family_member(async_client: httpx.AsyncClient, headers, member_id: str):
    # DELETE /users/family-member/{family_id} does cleanup and then delete_family_member.
    return await async_client.delete(f"/api/v1/users/family-member/{member_id}", headers=headers)


# ------------------------
# Auth / basic route protections
# ------------------------


async def test_family_member_routes_require_auth(async_client):
    """
    Core family routes should reject unauthenticated callers.
    """
    add_resp = await async_client.post(
        "/api/v1/users/add-family-member",
        json=_make_valid_family_member_payload(),
    )
    assert add_resp.status_code in (401, 403)

    list_resp = await async_client.get("/api/v1/users/all-family-members")
    assert list_resp.status_code in (401, 403)


# ------------------------
# Add + list
# ------------------------


async def test_add_family_member_and_list(async_client, auth_headers):
    """
    Happy-path flow:
      - List existing family members
      - Add a new one
      - Confirm it appears in /all-family-members and /family-member/{id}
    """
    base_list_resp = await _list_family_members(async_client, auth_headers)
    assert base_list_resp.status_code == 200
    base_body = base_list_resp.json()
    assert base_body.get("success") is True
    base_members = base_body.get("family_members") or []
    base_count = len(base_members)

    payload = _make_valid_family_member_payload(
        first_name="Pytest",
        last_name="Kid",
        gender="F",
    )

    create_resp = await _add_family_member(async_client, auth_headers, payload)
    assert create_resp.status_code == 201

    create_body = create_resp.json()
    assert create_body.get("success") is True
    assert "family_member" in create_body

    created = create_body["family_member"]
    member_id = created.get("id")
    assert member_id
    assert created["first_name"] == payload["first_name"]
    assert created["last_name"] == payload["last_name"]
    assert created["gender"] == payload["gender"]
    # Pydantic PersonOut exposes createdOn via alias; just make sure it's present.
    assert "createdOn" in created

    # It should appear in the list
    list_resp = await _list_family_members(async_client, auth_headers)
    assert list_resp.status_code == 200
    list_body = list_resp.json()
    assert list_body.get("success") is True

    members = list_body.get("family_members") or []
    assert len(members) == base_count + 1
    assert any(m["id"] == member_id for m in members)

    # And it should be fetchable by ID
    get_resp = await _get_family_member(async_client, auth_headers, member_id)
    assert get_resp.status_code == 200
    get_body = get_resp.json()
    assert get_body.get("success") is True
    member = get_body["family_member"]
    assert member["id"] == member_id
    assert member["first_name"] == payload["first_name"]
    assert member["last_name"] == payload["last_name"]


# ------------------------
# Update
# ------------------------


async def test_update_family_member_changes_core_fields(async_client, auth_headers):
    """
    Create a family member, then PATCH /family-member with PersonUpdateRequest
    and ensure the changes are reflected in subsequent GETs.
    """
    # First create a member to mutate
    create_payload = _make_valid_family_member_payload(
        first_name="Updatee",
        last_name="Original",
        gender="M",
    )
    create_resp = await _add_family_member(async_client, auth_headers, create_payload)
    assert create_resp.status_code == 201
    member_id = create_resp.json()["family_member"]["id"]

    # Build an update payload: PersonUpdateRequest = { id, optional fields }
    new_first = "Updated"
    new_last = "Family"
    new_gender = "F"
    new_dob = _make_birthdate_years_ago(5)

    update_payload = {
        "id": member_id,
        "first_name": new_first,
        "last_name": new_last,
        "gender": new_gender,
        "date_of_birth": new_dob,
    }

    update_resp = await _update_family_member(async_client, auth_headers, update_payload)
    assert update_resp.status_code == 200

    update_body = update_resp.json()
    assert update_body.get("success") is True
    assert "Family member updated successfully" in update_body.get("message", "")

    # Verify via GET /family-member/{id}
    get_resp = await _get_family_member(async_client, auth_headers, member_id)
    assert get_resp.status_code == 200
    member = get_resp.json()["family_member"]

    assert member["first_name"] == new_first
    assert member["last_name"] == new_last
    assert member["gender"] == new_gender
    assert member["date_of_birth"] is not None

    # Clean up
    delete_resp = await _delete_family_member(async_client, auth_headers, member_id)
    assert delete_resp.status_code == 200
    assert delete_resp.json().get("success") is True


async def test_update_family_member_unknown_id_returns_404(async_client, auth_headers):
    """
    PATCH with a well-formed but nonexistent ObjectId should result in 404.
    The controller raises HTTPException(404) when update_family_member() returns False.
    """
    bogus_id = "000000000000000000000000"  # valid hex length for ObjectId, but won't match anything

    payload = {
        "id": bogus_id,
        "first_name": "Nope",
    }

    resp = await _update_family_member(async_client, auth_headers, payload)
    # FastAPI will serialize the HTTPException into a 404 response
    assert resp.status_code == 404
    body = resp.json()
    assert body.get("detail") == "Family member not found"


# ------------------------
# Delete
# ------------------------


async def test_delete_family_member_removes_it_from_list_and_get(async_client, auth_headers):
    """
    Full delete flow:
      - Create a member
      - Confirm it is listed
      - DELETE it
      - Confirm GET by id is 404 and it's gone from /all-family-members
    """
    # Create member
    create_payload = _make_valid_family_member_payload(
        first_name="DeleteMe",
        last_name="Soon",
        gender="M",
    )
    create_resp = await _add_family_member(async_client, auth_headers, create_payload)
    assert create_resp.status_code == 201
    member_id = create_resp.json()["family_member"]["id"]

    # Confirm it appears in the list
    list_before = await _list_family_members(async_client, auth_headers)
    assert list_before.status_code == 200
    members_before = list_before.json().get("family_members") or []
    assert any(m["id"] == member_id for m in members_before)

    # Delete it – route performs event cleanup then delete_family_member.
    delete_resp = await _delete_family_member(async_client, auth_headers, member_id)
    assert delete_resp.status_code == 200
    delete_body = delete_resp.json()
    assert delete_body.get("success") is True
    assert "deleted successfully" in delete_body.get("message", "")

    # GET by id should now be 404
    get_resp = await _get_family_member(async_client, auth_headers, member_id)
    assert get_resp.status_code == 404
    get_body = get_resp.json()
    assert get_body.get("detail") == "Family member not found"

    # And it should be gone from /all-family-members
    list_after = await _list_family_members(async_client, auth_headers)
    assert list_after.status_code == 200
    members_after = list_after.json().get("family_members") or []
    assert all(m["id"] != member_id for m in members_after)


async def test_delete_family_member_unknown_id_returns_404(async_client, auth_headers):
    """
    Deleting a bogus family member id should surface 404.
    """
    bogus_id = "ffffffffffffffffffffffff"

    resp = await _delete_family_member(async_client, auth_headers, bogus_id)
    assert resp.status_code == 404
    body = resp.json()
    assert body.get("detail") == "Family member not found"
