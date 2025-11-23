import os
import httpx
import pytest
from dotenv import load_dotenv

from backend.tests.test_auth_helpers import get_auth_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for contact tests")

pytestmark = pytest.mark.anyio("asyncio")


@pytest.fixture
def anyio_backend():
    return "asyncio"


_AUTH_HEADERS = None


@pytest.fixture(scope="session")
def auth_headers():
    """
    Reuse the same auth header pattern as profile_change_tests to avoid
    hammering Firebase unnecessarily.
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


async def _get_profile(async_client: httpx.AsyncClient, headers):
    return await async_client.get("/api/v1/users/get-profile", headers=headers)


async def _update_contact(async_client: httpx.AsyncClient, headers, payload: dict):
    return await async_client.patch("/api/v1/users/update-contact", json=payload, headers=headers)


def _make_valid_contact_payload(contact_info: dict, **overrides) -> dict:
    """
    Build a complete ContactInfo payload using existing contact_info as a base,
    then layer overrides on top.

    ContactInfo in the backend:
      - phone: Optional[str]
      - address: AddressSchema (address, suite, city, state, country, postal_code)
    """
    base_address = contact_info.get("address") or {}
    base = {
        "phone": contact_info.get("phone") or "",
        "address": {
            "address": base_address.get("address"),
            "suite": base_address.get("suite"),
            "city": base_address.get("city"),
            "state": base_address.get("state"),
            "country": base_address.get("country"),
            "postal_code": base_address.get("postal_code"),
        },
    }
    base.update(overrides)
    return base


# ------------------------
# Basic routes
# ------------------------


async def test_update_contact_requires_auth(async_client):
    # No auth headers should not allow contact changes
    resp = await async_client.patch("/api/v1/users/update-contact", json={})
    assert resp.status_code in (401, 403)


# ------------------------
# Happy path
# ------------------------


async def test_update_contact_success_changes_phone_and_address(async_client, auth_headers):
    # Fetch current profile as a base for contact_info
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_body = base_resp.json()
    assert base_body.get("success") is True
    assert "contact_info" in base_body

    base_contact = base_body["contact_info"]
    base_address = base_contact.get("address") or {}

    # Construct new, valid phone and address
    # PHONE_RE allows +, digits, spaces, (), ., -, and requires at least 7 chars (after stripping spaces).
    # Controller strips spaces before applying PHONE_RE and before saving. :contentReference[oaicite:2]{index=2}
    phone_input = "+1 (555) 123-4567"
    expected_phone = phone_input.strip().replace(" ", "")

    new_address = {
        "address": (base_address.get("address") or "123 Test St") + " Suite 99",
        "suite": base_address.get("suite") or "Unit 9",
        "city": base_address.get("city") or "Testville",
        "state": base_address.get("state") or "TS",
        "country": base_address.get("country") or "US",
        "postal_code": base_address.get("postal_code") or "99999",
    }

    payload = _make_valid_contact_payload(
        base_contact,
        phone=phone_input,
        address=new_address,
    )

    resp = await _update_contact(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is True
    assert "contact_info" in body

    updated_contact = body["contact_info"]

    # Phone should be stored in the sanitized form (spaces removed)
    assert updated_contact["phone"] == expected_phone

    # Address fields should match what we sent
    for key, val in new_address.items():
        assert updated_contact["address"].get(key) == val

    # Confirm changes persisted with a fresh GET
    verify_resp = await _get_profile(async_client, auth_headers)
    assert verify_resp.status_code == 200
    verify_body = verify_resp.json()
    verify_contact = verify_body["contact_info"]

    assert verify_contact["phone"] == expected_phone
    for key, val in new_address.items():
        assert verify_contact["address"].get(key) == val


# ------------------------
# Validation failures
# ------------------------


async def test_update_contact_rejects_invalid_phone(async_client, auth_headers):
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_contact = base_resp.json()["contact_info"]

    # Invalid phone: too short / not matching PHONE_RE after stripping spaces
    invalid_phone = "12345"

    payload = _make_valid_contact_payload(
        base_contact,
        phone=invalid_phone,
    )

    resp = await _update_contact(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is False
    assert "Please enter a valid phone number" in body.get("msg", "")


# ------------------------
# Trivial / no-op updates
# ------------------------


async def test_update_contact_trivial_update_returns_success(async_client, auth_headers):
    """
    If phone and address are unchanged, controller should short-circuit,
    not touch the DB, and still return success with the same contact_info.
    :contentReference[oaicite:3]{index=3}
    """
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_body = base_resp.json()
    base_contact = base_body["contact_info"]

    payload = _make_valid_contact_payload(base_contact)

    # This should hit the trivial branch in update_contact
    resp = await _update_contact(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is True
    assert "contact_info" in body

    returned_contact = body["contact_info"]
    assert returned_contact["phone"] == (base_contact.get("phone") or "")
    assert returned_contact["address"] == (base_contact.get("address") or {})

    # Refetch and ensure nothing changed
    verify_resp = await _get_profile(async_client, auth_headers)
    assert verify_resp.status_code == 200
    verify_contact = verify_resp.json()["contact_info"]

    assert verify_contact["phone"] == (base_contact.get("phone") or "")
    assert verify_contact["address"] == (base_contact.get("address") or {})


# ------------------------
# Clearing phone while changing address
# ------------------------


async def test_update_contact_allows_empty_phone_and_updates_address(async_client, auth_headers):
    """
    update_contact treats empty/None phone as "" and does not run PHONE_RE on it.
    It should allow clearing the phone number while changing the address. :contentReference[oaicite:4]{index=4}
    """
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_body = base_resp.json()
    base_contact = base_body["contact_info"]
    base_address = base_contact.get("address") or {}

    new_address = {
        "address": (base_address.get("address") or "123 Test St") + " Apt 42",
        "suite": base_address.get("suite") or None,
        "city": base_address.get("city") or "New City",
        "state": base_address.get("state") or "NC",
        "country": base_address.get("country") or "US",
        "postal_code": base_address.get("postal_code") or "42424",
    }

    payload = _make_valid_contact_payload(
        base_contact,
        phone="",  # explicitly clear phone
        address=new_address,
    )

    resp = await _update_contact(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is True
    assert "contact_info" in body

    updated_contact = body["contact_info"]
    assert updated_contact["phone"] == ""
    for key, val in new_address.items():
        assert updated_contact["address"].get(key) == val

    # Confirm via fresh GET
    verify_resp = await _get_profile(async_client, auth_headers)
    assert verify_resp.status_code == 200
    verify_contact = verify_resp.json()["contact_info"]

    assert verify_contact["phone"] == ""
    for key, val in new_address.items():
        assert verify_contact["address"].get(key) == val
