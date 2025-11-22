import os
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from dotenv import load_dotenv

from backend.tests.test_auth_helpers import get_auth_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")

if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for profile tests")

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


# ------------------------
# Helpers
# ------------------------


async def _get_profile(async_client: httpx.AsyncClient, headers):
    return await async_client.get("/api/v1/users/get-profile", headers=headers)


async def _update_profile(async_client: httpx.AsyncClient, headers, payload: dict):
    return await async_client.patch("/api/v1/users/update-profile", json=payload, headers=headers)


def _make_valid_profile_payload(profile_info: dict, **overrides) -> dict:
    """
    Build a complete PersonalInfo payload using existing profile_info as a base,
    then layer overrides on top.
    """
    base = {
        "first_name": profile_info.get("first_name") or "Test",
        "last_name": profile_info.get("last_name") or "User",
        "email": profile_info.get("email") or "test@example.com",
        "membership": profile_info.get("membership", False),
        "birthday": profile_info.get("birthday"),
        "gender": profile_info.get("gender") or "M",
    }
    base.update(overrides)
    return base


def _make_over_13_birthday() -> str:
    """
    Return an ISO8601 datetime string safely older than 13 years.
    """
    twenty_years_ago = datetime.now(timezone.utc) - timedelta(days=365 * 20)
    return twenty_years_ago.isoformat()


def _make_under_13_birthday() -> str:
    """
    Return an ISO8601 datetime string clearly under 13 years.
    """
    five_years_ago = datetime.now(timezone.utc) - timedelta(days=365 * 5)
    return five_years_ago.isoformat()


# ------------------------
# Basic view routes
# ------------------------


async def test_get_profile_authenticated_user(async_client, auth_headers):
    resp = await _get_profile(async_client, auth_headers)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is True
    assert "profile_info" in body
    assert "contact_info" in body

    profile = body["profile_info"]
    assert isinstance(profile, dict)
    assert "first_name" in profile
    assert "last_name" in profile
    assert "email" in profile
    assert "membership" in profile


async def test_get_profile_requires_auth(async_client):
    # No auth headers should not expose profile
    resp = await async_client.get("/api/v1/users/get-profile")
    assert resp.status_code in (401, 403)


# ------------------------
# Happy path: change profile core fields
# ------------------------


async def test_update_profile_success_changes_name_dob_gender(async_client, auth_headers):
    # Fetch current profile as a base
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_body = base_resp.json()
    assert base_body.get("success") is True

    base_profile = base_body["profile_info"]

    # Construct new, valid values for the core fields
    current_first = base_profile.get("first_name") or "Test"
    current_last = base_profile.get("last_name") or "User"
    current_gender = (base_profile.get("gender") or "M").upper()

    new_first_name = current_first + "X"
    new_last_name = current_last + "Y"
    new_birthday = _make_over_13_birthday()
    new_gender = "F" if current_gender != "F" else "M"

    payload = _make_valid_profile_payload(
        base_profile,
        first_name=new_first_name,
        last_name=new_last_name,
        birthday=new_birthday,
        gender=new_gender,
    )

    resp = await _update_profile(async_client, auth_headers, payload)
    assert resp.status_code == 200
    body = resp.json()

    assert body.get("success") is True
    assert "profile_info" in body

    updated_profile = body["profile_info"]
    assert updated_profile["first_name"] == new_first_name.strip()
    assert updated_profile["last_name"] == new_last_name.strip()
    assert (updated_profile.get("gender") or "").upper() == new_gender.upper()
    assert updated_profile.get("birthday") is not None

    # Confirm changes persisted with a fresh GET
    verify_resp = await _get_profile(async_client, auth_headers)
    assert verify_resp.status_code == 200
    verify_profile = verify_resp.json()["profile_info"]

    assert verify_profile["first_name"] == new_first_name.strip()
    assert verify_profile["last_name"] == new_last_name.strip()
    assert (verify_profile.get("gender") or "").upper() == new_gender.upper()
    assert verify_profile.get("birthday") is not None


# ------------------------
# Validation failures
# ------------------------


async def test_update_profile_rejects_invalid_names(async_client, auth_headers):
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_profile = base_resp.json()["profile_info"]

    # First name is invalid (fails NAME_RE), last_name kept valid
    payload = _make_valid_profile_payload(
        base_profile,
        first_name="1234",  # clearly invalid per name regex
    )

    resp = await _update_profile(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is False
    assert "Please enter valid name inputs" in body.get("msg", "")


async def test_update_profile_rejects_missing_birthday(async_client, auth_headers):
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_profile = base_resp.json()["profile_info"]

    payload = _make_valid_profile_payload(base_profile)
    # Explicitly drop birthday from payload so it resolves to None
    payload.pop("birthday", None)

    resp = await _update_profile(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is False
    assert "13 years or older" in body.get("msg", "")


async def test_update_profile_rejects_under_13_birthday(async_client, auth_headers):
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_profile = base_resp.json()["profile_info"]

    payload = _make_valid_profile_payload(
        base_profile,
        birthday=_make_under_13_birthday(),
    )

    resp = await _update_profile(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is False
    # Same message as missing birthday
    assert "13 years or older" in body.get("msg", "")


async def test_update_profile_rejects_invalid_gender(async_client, auth_headers):
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_profile = base_resp.json()["profile_info"]

    payload = _make_valid_profile_payload(
        base_profile,
        birthday=_make_over_13_birthday(),  # keep birthday valid
        gender="X",  # invalid gender
    )

    resp = await _update_profile(async_client, auth_headers, payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body.get("success") is False
    assert "Please select a gender" in body.get("msg", "")


async def test_update_profile_does_not_change_email_or_membership(async_client, auth_headers):
    """
    Ensure that /update-profile cannot be used to change email or membership,
    even if those fields are provided in the payload.
    """
    base_resp = await _get_profile(async_client, auth_headers)
    assert base_resp.status_code == 200
    base_profile = base_resp.json()["profile_info"]

    original_email = base_profile.get("email")
    original_membership = base_profile.get("membership", False)

    payload = _make_valid_profile_payload(
        base_profile,
        # Attempt to change these fields
        email="changed+pytest@example.com",
        membership=not original_membership,
        # Keep other fields valid
        birthday=_make_over_13_birthday(),
        gender=(base_profile.get("gender") or "M"),
    )

    resp = await _update_profile(async_client, auth_headers, payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True

    # Refetch and verify email and membership have not changed
    verify_resp = await _get_profile(async_client, auth_headers)
    assert verify_resp.status_code == 200
    verify_profile = verify_resp.json()["profile_info"]

    assert verify_profile.get("email") == original_email
    assert verify_profile.get("membership", False) == original_membership
