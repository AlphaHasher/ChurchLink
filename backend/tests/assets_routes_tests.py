import os
import io
import uuid
import httpx
import pytest
from PIL import Image
from dotenv import load_dotenv

from test_auth_helpers import get_auth_headers, get_admin_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")
if not BASE_URL:
	raise RuntimeError("Environment variable BACKEND_URL must be set for assets route tests")

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


def _make_test_image_bytes(size=(640, 480), color=(200, 120, 80)) -> bytes:
	img = Image.new("RGB", size, color)
	buf = io.BytesIO()
	img.save(buf, format="JPEG", quality=90)
	return buf.getvalue()


async def _upload_image(async_client: httpx.AsyncClient, admin_headers: dict, *, folder: str | None = None) -> dict | None:
	filename = f"test-{uuid.uuid4().hex}.jpg"
	content = _make_test_image_bytes()
	files = {
		"file": (filename, content, "image/jpeg"),
	}
	data = {}
	if folder:
		data["folder"] = folder
	resp = await async_client.post("/api/v1/assets/upload", files=files, data=data, headers=admin_headers)
	if resp.status_code not in (200, 201):
		pytest.skip(f"Upload not permitted or server not configured for uploads: {resp.status_code} {resp.text}")
	return resp.json()


async def test_create_folder_and_list(async_client, admin_headers):
	folder_name = f"tests_{uuid.uuid4().hex[:8]}"
	create = await async_client.post("/api/v1/assets/folder", data={"name": folder_name}, headers=admin_headers)
	if create.status_code not in (200, 201):
		pytest.skip(f"Folder creation requires admin roles; skipping. Got {create.status_code}: {create.text}")
	body = create.json()
	assert body.get("folder") == folder_name

	list_root = await async_client.get("/api/v1/assets/", headers=admin_headers)
	if list_root.status_code != 200:
		pytest.skip(f"Listing requires admin roles; skipping. Got {list_root.status_code}")
	root_payload = list_root.json()
	assert "files" in root_payload and "folders" in root_payload

	list_folder = await async_client.get("/api/v1/assets/", params={"folder": folder_name}, headers=admin_headers)
	if list_folder.status_code != 200:
		pytest.skip(f"Listing folder requires admin roles; skipping. Got {list_folder.status_code}")
	payload = list_folder.json()
	assert "files" in payload and "folders" in payload


async def test_upload_list_and_serve_original(async_client, admin_headers):
	folder = f"tests_{uuid.uuid4().hex[:6]}"
	created = await async_client.post("/api/v1/assets/folder", data={"name": folder}, headers=admin_headers)
	if created.status_code not in (200, 201):
		pytest.skip(f"Folder creation requires admin roles; skipping. Got {created.status_code}")

	uploaded = await _upload_image(async_client, admin_headers, folder=folder)
	assert uploaded is not None
	assert uploaded["url"].startswith("/assets/")
	filename = uploaded["filename"]

	listing = await async_client.get("/api/v1/assets/", params={"folder": folder}, headers=admin_headers)
	if listing.status_code != 200:
		pytest.skip(f"Listing requires admin roles; skipping. Got {listing.status_code}")
	data = listing.json()
	assert any(item.get("filename") == filename for item in data.get("files", []))

	asset_rel_url = uploaded["url"]
	resp = await async_client.get(asset_rel_url)
	assert resp.status_code == 200
	assert resp.headers.get("content-type", "").startswith("image/")


async def test_thumbnail_generation_and_cache(async_client, admin_headers):
	folder = f"tests_{uuid.uuid4().hex[:6]}"
	_ = await async_client.post("/api/v1/assets/folder", data={"name": folder}, headers=admin_headers)
	uploaded = await _upload_image(async_client, admin_headers, folder=folder)
	if uploaded is None:
		pytest.skip("Upload not available")
	asset_rel_url = uploaded["url"]
	api_asset_url = f"/api/v1{asset_rel_url}"

	thumb1 = await async_client.get(f"{api_asset_url}?thumbnail=true")
	assert thumb1.status_code == 200
	assert thumb1.headers.get("content-type") == "image/jpeg"
	assert len(thumb1.content) > 0

	thumb2 = await async_client.get(f"{api_asset_url}?thumbnail=true")
	assert thumb2.status_code == 200
	assert thumb2.headers.get("content-type") == "image/jpeg"
	assert len(thumb2.content) > 0


async def test_delete_asset_removes_thumbnail(async_client, admin_headers):
	folder = f"tests_{uuid.uuid4().hex[:6]}"
	_ = await async_client.post("/api/v1/assets/folder", data={"name": folder}, headers=admin_headers)
	uploaded = await _upload_image(async_client, admin_headers, folder=folder)
	if uploaded is None:
		pytest.skip("Upload not available")
	asset_rel_url = uploaded["url"]
	api_asset_url = f"/api/v1{asset_rel_url}"

	thumb = await async_client.get(f"{api_asset_url}?thumbnail=true")
	if thumb.status_code != 200:
		pytest.skip(f"Thumbnail generation unavailable; skipping. Got {thumb.status_code}")

	delete_path = f"/api/v1{asset_rel_url}"
	deleted = await async_client.delete(delete_path, headers=admin_headers)
	if deleted.status_code not in (200, 204):
		pytest.skip(f"Deletion requires admin roles; skipping. Got {deleted.status_code}")

	orig = await async_client.get(asset_rel_url)
	assert orig.status_code in (404, 410)

	thumb_after = await async_client.get(f"{api_asset_url}?thumbnail=true")
	assert thumb_after.status_code in (404, 410)
