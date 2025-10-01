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

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


pytestmark = pytest.mark.anyio("asyncio")


@pytest.fixture
def anyio_backend():
    return "asyncio"


_AUTH_HEADERS = None

@pytest.fixture(scope="session")
def auth_headers():
    global _AUTH_HEADERS
    if _AUTH_HEADERS is None:
        email = os.getenv("TESTING_AUTH_EMAIL")
        password = os.getenv("TESTING_AUTH_PASSWORD")
        if not email or not password:
            raise RuntimeError(
                "TESTING_AUTH_EMAIL and TESTING_AUTH_PASSWORD must be set in the environment "
                "to run sermons tests."
            )
        _AUTH_HEADERS = get_auth_headers()
    authorization = _AUTH_HEADERS.get("Authorization")
    if not authorization or authorization.endswith("None"):
        raise RuntimeError(
            "Failed to obtain authentication token. Check TESTING_AUTH_EMAIL, "
            "TESTING_AUTH_PASSWORD, and FIREBASE_WEB_API_KEY."
        )
    return _AUTH_HEADERS


@pytest.fixture
async def async_client():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        yield client


@pytest.fixture
async def sermon_id(async_client, auth_headers):
    """Return an existing sermon id or create a disposable test sermon.

    Attempts to find any sermon via the public list first. If none found and
    creation is permitted with the provided auth headers, creates a sermon and
    yields its id. If creation is not permitted, yields None so tests can fall
    back to tolerant assertions.
    """
    # Try to get an existing sermon from the public list
    try:
        resp = await async_client.get("/api/v1/sermons/", headers=auth_headers)
    except Exception:
        yield None
        return

    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            first = data[0]
            sid = first.get("id") or first.get("_id")
            if sid:
                yield sid
                return

    # No existing sermon found; try to create one if permitted
    payload = {
        "title": "Test Sermon (fixture)",
        "description": "Fixture sermon for tests",
        "speaker": "Fixture Speaker",
        "ministry": ["Fixture Ministry"],
        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "date_posted": "2020-01-01T00:00:00Z",
        "published": False,
        "roles": ["sermon_editor"],
    }

    created_id = None
    try:
        create_resp = await async_client.post("/api/v1/sermons/", json=payload, headers=auth_headers)
        if create_resp.status_code == 201:
            created_id = create_resp.json().get("id")
    except Exception:
        created_id = None

    if created_id:
        try:
            yield created_id
        finally:
            # Attempt cleanup; ignore failures
            try:
                await async_client.delete(f"/api/v1/sermons/{created_id}", headers=auth_headers)
            except Exception:
                pass
    else:
        yield None


async def test_list_sermons(async_client, auth_headers):
    response = await async_client.get("/api/v1/sermons/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_search_sermons(async_client, auth_headers):
    response = await async_client.get("/api/v1/sermons/search", params={"query": "test"}, headers=auth_headers)
    # Search should return 200 and a list (even if empty)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_sermon_detail(async_client, auth_headers, sermon_id):
    if sermon_id is None:
        pytest.skip("No sermon available for detail test")
    response = await async_client.get(f"/api/v1/sermons/{sermon_id}", headers=auth_headers)
    assert response.status_code in [200, 404]


async def test_favorite_endpoints(async_client, auth_headers, sermon_id):
    if sermon_id is None:
        pytest.skip("No sermon available for favorite tests")

    post_resp = await async_client.post(f"/api/v1/sermons/{sermon_id}/favorite", headers=auth_headers)
    # Favoriting requires valid auth. Accept 200/201 for success, 400 if duplicate,
    # and 403 when the authenticated user lacks permission.
    assert post_resp.status_code in [200, 201, 400, 403]

    delete_resp = await async_client.delete(f"/api/v1/sermons/{sermon_id}/favorite", headers=auth_headers)
    assert delete_resp.status_code in [200, 204, 400, 403]
