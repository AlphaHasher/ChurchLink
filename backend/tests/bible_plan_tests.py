#tested 1 error on nov 22

import os
import httpx
import pytest
from dotenv import load_dotenv
from bson import ObjectId

from backend.tests.test_auth_helpers import get_auth_headers, get_admin_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")

if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for bible plan tests")

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


async def test_create_plan(async_client, admin_headers):
    response = await async_client.post(
        "/api/v1/bible-plans/",
        json={
            "name": "Test Plan",
            "duration": 1,
            "readings": {
                "1": [
                    {
                        "id": "genesis-1-1",
                        "book": "Genesis",
                        "chapter": 1,
                        "endChapter": 1,
                        "startVerse": 1,
                        "endVerse": 5,
                        "reference": "Genesis 1:1-5",
                    }
                ]
            },
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert "id" in body

    plan_id = body["id"]
    delete_response = await async_client.delete(f"/api/v1/bible-plans/{plan_id}", headers=admin_headers)
    assert delete_response.status_code == 200

async def test_forbid_create_plan(async_client, auth_headers):
    response = await async_client.post(
        "/api/v1/bible-plans/",
        json={
            "name": "Test Plan",
            "duration": 1,
            "readings": {
                "1": [
                    {
                        "id": "genesis-1-1",
                        "book": "Genesis",
                        "chapter": 1,
                        "endChapter": 1,
                        "startVerse": 1,
                        "endVerse": 5,
                        "reference": "Genesis 1:1-5",
                    }
                ]
            },
        },
        headers=auth_headers,
    )
    assert response.status_code == 403


async def test_list_plans(async_client, admin_headers):
    response = await async_client.get("/api/v1/bible-plans/", headers=admin_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

async def test_forbid_list_plans(async_client, auth_headers):
    response = await async_client.get("/api/v1/bible-plans/", headers=auth_headers)
    assert response.status_code == 403


async def test_list_bible_plan_templates(async_client, admin_headers):
    response = await async_client.get("/api/v1/bible-plans/templates", headers=admin_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_forbid_list_bible_plan_templates(async_client, auth_headers):
    response = await async_client.get("/api/v1/bible-plans/templates", headers=auth_headers)
    assert response.status_code in [400, 403]


async def test_forbid_get_bible_plan_template_by_id(async_client, auth_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/templates/id/test-template-id",
        headers=auth_headers,
    )
    assert response.status_code == 403


async def test_get_bible_plan_template_by_name(async_client, admin_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/templates/test-template-name",
        headers=admin_headers,
    )
    assert response.status_code in [200, 404]

async def test_forbid_get_bible_plan_template_by_name(async_client, auth_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/templates/test-template-name",
        headers=auth_headers,
    )
    assert response.status_code == 403


async def test_get_user_plans(async_client, admin_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/user/test-user-id",
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)

async def test_forbid_get_user_plans(async_client, auth_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/user/test-user-id",
        headers=auth_headers,
    )
    assert response.status_code == 403


async def test_forbid_get_plan(async_client, auth_headers):
    valid_object_id = str(ObjectId())
    response = await async_client.get(
        f"/api/v1/bible-plans/{valid_object_id}",
        headers=auth_headers,
    )
    assert response.status_code in [403, 404]


async def test_forbid_update_plan(async_client, auth_headers):
    response = await async_client.put(
        "/api/v1/bible-plans/test-plan-id",
        json={"name": "Updated Plan", "description": "Updated description", "days": []},
        headers=auth_headers,
    )
    assert response.status_code == 403
