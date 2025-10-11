import os
import sys
import uuid
from typing import Any, Dict, Optional, Tuple
import httpx
import pytest
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, "..", ".."))

if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from backend.tests.test_auth_helpers import get_auth_headers, get_admin_headers

BASE_URL = os.getenv("BACKEND_URL")

if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for forms tests")

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


def unique_suffix() -> str:
    return uuid.uuid4().hex[:8]


def build_form_payload(**overrides: Any) -> Dict[str, Any]:
    suffix = overrides.get("suffix") or unique_suffix()
    payload = {
        "title": overrides.get("title") or f"Test Form {suffix}",
        "description": overrides.get("description", "Integration test form"),
        "folder": overrides.get("folder"),
        "visible": overrides.get("visible", True),
        "slug": overrides.get("slug"),
        "data": overrides.get(
            "data",
            [
                {"name": "email", "label": "Email", "type": "email", "required": True},
                {"name": "message", "label": "Message", "type": "text", "required": False},
            ],
        ),
    }
    return payload


def unique_slug(prefix: str = "test-form") -> str:
    return f"{prefix}-{unique_suffix()}"


async def create_form_record(
    async_client: httpx.AsyncClient,
    auth_headers: Dict[str, str],
    payload: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    body = payload or build_form_payload()
    response = await async_client.post("/api/v1/forms/", json=body, headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json(), body


async def delete_form(async_client: httpx.AsyncClient, auth_headers: Dict[str, str], form_id: str) -> None:
    purge = await async_client.delete(f"/api/v1/forms/{form_id}/responses", headers=auth_headers)
    assert purge.status_code in {200, 404}
    await async_client.delete(f"/api/v1/forms/{form_id}", headers=auth_headers)


async def test_create_form_success(async_client, admin_headers):
    payload = build_form_payload(slug=unique_slug("form-success"))
    created, body = await create_form_record(async_client, admin_headers, payload)
    try:
        assert created["title"] == body["title"]
        assert created["slug"] == body["slug"]
        assert created["visible"] is True
        assert "id" in created
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_create_form_requires_auth(async_client):
    payload = build_form_payload()
    response = await async_client.post("/api/v1/forms/", json=payload)
    assert response.status_code in {401, 403}


async def test_create_form_duplicate_title_conflict(async_client, admin_headers):
    payload = build_form_payload()
    created, body = await create_form_record(async_client, admin_headers, payload)
    try:
        duplicate = await async_client.post("/api/v1/forms/", json=body, headers=admin_headers)
        assert duplicate.status_code == 409
        detail = duplicate.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("existing_id") == created["id"]
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_create_form_slug_conflict(async_client, admin_headers):
    slug = unique_slug("conflict")
    first_payload = build_form_payload(slug=slug)
    created, _ = await create_form_record(async_client, admin_headers, first_payload)
    try:
        second_payload = build_form_payload(title=f"Another {unique_suffix()}", slug=slug)
        conflict = await async_client.post("/api/v1/forms/", json=second_payload, headers=admin_headers)
        assert conflict.status_code == 409
        detail = conflict.json().get("detail")
        assert isinstance(detail, (dict, str))
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_list_forms_requires_auth(async_client, admin_headers):
    created, _ = await create_form_record(async_client, admin_headers)
    try:
        response = await async_client.get("/api/v1/forms/", headers=admin_headers)
        assert response.status_code == 200
        forms = response.json()
        assert isinstance(forms, list)
        assert any(form["id"] == created["id"] for form in forms)

        unauthorized = await async_client.get("/api/v1/forms/")
        assert unauthorized.status_code in {401, 403}
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_search_forms_filters_by_name(async_client, admin_headers):
    marker = f"Search-{unique_suffix()}"
    payload = build_form_payload(title=f"{marker} Example")
    created, body = await create_form_record(async_client, admin_headers, payload)
    try:
        response = await async_client.get(
            "/api/v1/forms/search",
            params={"name": marker},
            headers=admin_headers,
        )
        assert response.status_code == 200
        results = response.json()
        assert any(item["id"] == created["id"] for item in results)

        unauthorized = await async_client.get(
            "/api/v1/forms/search",
            params={"name": marker},
        )
        assert unauthorized.status_code in {401, 403}
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_create_folder_success_and_duplicate(async_client, admin_headers):
    folder_name = f"folder-{unique_suffix()}"
    created = await async_client.post(
        "/api/v1/forms/folders",
        params={"name": folder_name},
        headers=admin_headers,
    )
    assert created.status_code == 201
    data = created.json()
    assert data.get("name").lower() == folder_name.lower()
    folder_id = data.get("_id")
    assert folder_id

    try:
        duplicate = await async_client.post(
            "/api/v1/forms/folders",
            params={"name": folder_name},
            headers=admin_headers,
        )
        assert duplicate.status_code == 409

        unauthorized = await async_client.post(
            "/api/v1/forms/folders",
            params={"name": f"folder-unauth-{unique_suffix()}"},
        )
        assert unauthorized.status_code in {401, 403}
    finally:
        if folder_id:
            deleted = await async_client.delete(
                f"/api/v1/forms/folders/{folder_id}",
                headers=admin_headers,
            )
            assert deleted.status_code == 200


async def test_list_folders_requires_auth(async_client, admin_headers):
    folder_name = f"folder-{unique_suffix()}"
    created = await async_client.post(
        "/api/v1/forms/folders",
        params={"name": folder_name},
        headers=admin_headers,
    )
    assert created.status_code == 201
    created_data = created.json()
    folder_id = created_data.get("_id")
    assert folder_id

    try:
        response = await async_client.get("/api/v1/forms/folders", headers=admin_headers)
        assert response.status_code == 200
        folders = response.json()
        assert any(folder.get("name", "").lower() == folder_name.lower() for folder in folders)

        unauthorized = await async_client.get("/api/v1/forms/folders")
        assert unauthorized.status_code in {401, 403}
    finally:
        if folder_id:
            deleted = await async_client.delete(
                f"/api/v1/forms/folders/{folder_id}",
                headers=admin_headers,
            )
            assert deleted.status_code == 200


async def test_get_form_by_id_success_and_not_found(async_client, admin_headers):
    created, body = await create_form_record(async_client, admin_headers)
    try:
        response = await async_client.get(f"/api/v1/forms/{created['id']}", headers=admin_headers)
        assert response.status_code == 200
        fetched = response.json()
        assert fetched["id"] == created["id"]
        assert fetched["title"] == body["title"]

        missing_id = str(ObjectId())
        missing = await async_client.get(f"/api/v1/forms/{missing_id}", headers=admin_headers)
        assert missing.status_code == 404

        unauthorized = await async_client.get(f"/api/v1/forms/{created['id']}")
        assert unauthorized.status_code in {401, 403}
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_get_form_by_slug_requires_auth(async_client, admin_headers):
    slug = unique_slug("public")
    payload = build_form_payload(slug=slug)
    created, _ = await create_form_record(async_client, admin_headers, payload)
    try:
        authed = await async_client.get(f"/api/v1/forms/slug/{slug}", headers=admin_headers)
        assert authed.status_code == 200
        data = authed.json()
        assert data["id"] == created["id"]

        missing = await async_client.get(
            f"/api/v1/forms/slug/{unique_slug('missing')}",
            headers=admin_headers,
        )
        assert missing.status_code == 404

        unauthorized = await async_client.get(f"/api/v1/forms/slug/{slug}")
        assert unauthorized.status_code in {401, 403}
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_update_form_success(async_client, admin_headers):
    created, _ = await create_form_record(async_client, admin_headers)
    try:
        update_payload = {
            "title": f"Updated {unique_suffix()}",
            "description": "Updated description",
            "visible": False,
            "data": [
                {"name": "full_name", "label": "Full Name", "type": "text", "required": True},
            ],
        }
        response = await async_client.put(
            f"/api/v1/forms/{created['id']}",
            json=update_payload,
            headers=admin_headers,
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["title"] == update_payload["title"]
        assert updated["visible"] is False

        unauthorized = await async_client.put(
            f"/api/v1/forms/{created['id']}",
            json=update_payload,
        )
        assert unauthorized.status_code in {401, 403}
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_update_form_duplicate_title_conflict(async_client, admin_headers):
    first, first_body = await create_form_record(async_client, admin_headers)
    second, second_body = await create_form_record(async_client, admin_headers)
    try:
        conflict = await async_client.put(
            f"/api/v1/forms/{second['id']}",
            json={"title": first_body["title"]},
            headers=admin_headers,
        )
        assert conflict.status_code == 409
        detail = conflict.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("existing_id") == first["id"]
    finally:
        await delete_form(async_client, admin_headers, first["id"])
        await delete_form(async_client, admin_headers, second["id"])


async def test_update_form_slug_conflict(async_client, admin_headers):
    slug = unique_slug("dup-slug")
    first, _ = await create_form_record(async_client, admin_headers, build_form_payload(slug=slug))
    second, _ = await create_form_record(async_client, admin_headers)
    try:
        conflict = await async_client.put(
            f"/api/v1/forms/{second['id']}",
            json={"slug": slug},
            headers=admin_headers,
        )
        assert conflict.status_code == 409
    finally:
        await delete_form(async_client, admin_headers, first["id"])
        await delete_form(async_client, admin_headers, second["id"])


async def test_update_form_not_found(async_client, admin_headers):
    missing_id = str(ObjectId())
    response = await async_client.put(
        f"/api/v1/forms/{missing_id}",
        json={"title": "Does not exist"},
        headers=admin_headers,
    )
    assert response.status_code == 404


async def test_delete_form_success(async_client, admin_headers):
    created, _ = await create_form_record(async_client, admin_headers)

    response = await async_client.delete(f"/api/v1/forms/{created['id']}", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body.get("message") == "Form deleted"

    missing = await async_client.get(f"/api/v1/forms/{created['id']}", headers=admin_headers)
    assert missing.status_code == 404


async def test_delete_form_requires_auth(async_client, admin_headers):
    created, _ = await create_form_record(async_client, admin_headers)
    try:
        unauthorized = await async_client.delete(f"/api/v1/forms/{created['id']}")
        assert unauthorized.status_code in {401, 403}
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_delete_form_not_found(async_client, admin_headers):
    missing_id = str(ObjectId())
    response = await async_client.delete(f"/api/v1/forms/{missing_id}", headers=admin_headers)
    assert response.status_code == 404


async def test_submit_response_success_and_owner_can_list(async_client, admin_headers):
    slug = unique_slug("response-success")
    payload = build_form_payload(
        slug=slug,
        data=[
            {"name": "email", "label": "Email", "type": "email", "required": True},
            {"name": "consent", "label": "Consent", "type": "checkbox", "required": True},
        ],
    )
    created, _ = await create_form_record(async_client, admin_headers, payload)
    try:
        response_payload = {"email": "tester@example.com", "consent": True}
        submit = await async_client.post(
            f"/api/v1/forms/slug/{slug}/responses",
            json=response_payload,
            headers=admin_headers,
        )
        assert submit.status_code == 200
        body = submit.json()
        assert body.get("message") == "Response recorded"

        responses = await async_client.get(
            f"/api/v1/forms/{created['id']}/responses",
            headers=admin_headers,
        )
        assert responses.status_code == 200
        data = responses.json()
        assert data["form_id"] == created["id"]
        assert data["count"] >= 1
        assert any(item["response"].get("email") == "tester@example.com" for item in data["items"])

        unauthorized = await async_client.post(
            f"/api/v1/forms/slug/{slug}/responses",
            json=response_payload,
        )
        assert unauthorized.status_code in {401, 403}
    finally:
        purge = await async_client.delete(
            f"/api/v1/forms/{created['id']}/responses",
            headers=admin_headers,
        )
        assert purge.status_code == 200
        await delete_form(async_client, admin_headers, created["id"])


async def test_submit_response_validation_error(async_client, admin_headers):
    slug = unique_slug("response-invalid")
    payload = build_form_payload(
        slug=slug,
        data=[
            {"name": "email", "label": "Email", "type": "email", "required": True},
        ],
    )
    created, _ = await create_form_record(async_client, admin_headers, payload)
    try:
        invalid = await async_client.post(
            f"/api/v1/forms/slug/{slug}/responses",
            json={"email": "not-an-email"},
            headers=admin_headers,
        )
        assert invalid.status_code == 400
        detail = invalid.json().get("detail")
        assert isinstance(detail, str)
        assert "valid email" in detail.lower()
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_submit_response_form_not_found_with_auth(async_client, admin_headers):
    response = await async_client.post(
        f"/api/v1/forms/slug/{unique_slug('unknown')}/responses",
        json={"email": "missing@example.com"},
        headers=admin_headers,
    )
    assert response.status_code == 400
    assert response.json().get("detail") == "Form not found"


async def test_submit_response_form_not_found_requires_auth(async_client):
    response = await async_client.post(
        f"/api/v1/forms/slug/{unique_slug('unknown')}/responses",
        json={"email": "missing@example.com"},
    )
    assert response.status_code in {401, 403}


async def test_list_form_responses_requires_auth(async_client, admin_headers):
    created, _ = await create_form_record(async_client, admin_headers)
    try:
        unauthorized = await async_client.get(f"/api/v1/forms/{created['id']}/responses")
        assert unauthorized.status_code in {401, 403}
    finally:
        await delete_form(async_client, admin_headers, created["id"])


async def test_list_form_responses_not_found(async_client, admin_headers):
    missing_id = str(ObjectId())
    response = await async_client.get(
        f"/api/v1/forms/{missing_id}/responses",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["form_id"] == missing_id
    assert data["count"] == 0
    assert data["items"] == []
