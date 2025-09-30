import os
import sys
import httpx
import pytest
from dotenv import load_dotenv

TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, "..", ".."))

if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from backend.tests.test_auth_helpers import get_auth_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")

if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for bible plan tests")


pytestmark = pytest.mark.anyio("asyncio")


@pytest.fixture
def anyio_backend():
    return "asyncio"

_AUTH_HEADERS = None

@pytest.fixture(scope="session")
def auth_headers():
    global _AUTH_HEADERS
    if _AUTH_HEADERS is None:
        _AUTH_HEADERS = get_auth_headers()
    return _AUTH_HEADERS


@pytest.fixture
async def async_client():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        yield client


async def test_create_plan(async_client, auth_headers):
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
    assert response.status_code == 201
    body = response.json()
    assert "id" in body

    plan_id = body["id"]
    delete_response = await async_client.delete(f"/api/v1/bible-plans/{plan_id}", headers=auth_headers)
    assert delete_response.status_code == 200


async def test_list_plans(async_client, auth_headers):
    response = await async_client.get("/api/v1/bible-plans/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_list_bible_plan_templates(async_client, auth_headers):
    response = await async_client.get("/api/v1/bible-plans/templates", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_bible_plan_template_by_id(async_client, auth_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/templates/id/test-template-id",
        headers=auth_headers,
    )
    assert response.status_code in [200, 404]


async def test_get_bible_plan_template_by_name(async_client, auth_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/templates/test-template-name",
        headers=auth_headers,
    )
    assert response.status_code in [200, 404]


async def test_get_user_plans(async_client, auth_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/user/test-user-id",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_plan(async_client, auth_headers):
    response = await async_client.get(
        "/api/v1/bible-plans/test-plan-id",
        headers=auth_headers,
    )
    assert response.status_code in [200, 404]


async def test_update_plan(async_client, auth_headers):
    response = await async_client.put(
        "/api/v1/bible-plans/test-plan-id",
        json={"name": "Updated Plan", "description": "Updated description", "days": []},
        headers=auth_headers,
    )
    assert response.status_code in [200, 404]
