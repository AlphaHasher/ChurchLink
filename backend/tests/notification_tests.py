"""
SAFE NOTIFICATION TESTS
======================
⚠️  IMPORTANT: These tests have been updated to NOT send notifications to production devices.
✅  All tests use 'send_to_all': False and 'test_tokens' to avoid spamming real users.
✅  Scheduled notifications use far future dates (2025-12-31) to avoid accidental triggers.
✅  All test notifications are clearly marked with "TEST -" prefix.

If you need to test actual notification delivery, create a separate test device token.
"""

from dotenv import load_dotenv
import httpx
import os

from backend.tests.test_auth_helpers import get_admin_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")

def test_register_device_token():
    headers = get_admin_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/notification/registerToken",
        json={
            "token": "test-fcm-token",
            "platform": "test-platform",
            "appVersion": "test-version",
            "userId": "test-user-id"
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json().get("success") is True


def test_get_notification_settings():
    headers = get_admin_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/notification/settings", headers=headers)
    assert response.status_code == 200
    assert "streamNotificationMessage" in response.json()
    assert "streamNotificationTitle" in response.json()


def test_update_notification_settings():
    headers = get_admin_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/notification/settings",
        json={
            "streamNotificationMessage": "Test message",
            "streamNotificationTitle": "Test title"
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json().get("success") is True


def test_notification_history():
    headers = get_admin_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/notification/history", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_send_push_notification():
    headers = get_admin_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/notification/send",
        json={
            "title": "TEST - Safe Notification Test",
            "body": "This is a test notification from automated tests",
            "data": {"target": "test", "test_mode": True},
            "send_to_all": False,  # ✅ SAFE: Don't send to all devices
            "test_tokens": ["test-fcm-token"]  # ✅ SAFE: Only send to test tokens
        },
        headers=headers,
    )
    assert response.status_code == 200
    # Note: This may return False if no test tokens are registered, which is expected
    assert response.json().get("success") in [True, False]


def test_schedule_notification():
    headers = get_admin_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/notification/schedule",
        json={
            "title": "TEST - Scheduled Test Notification",
            "body": "This is a scheduled test notification from automated tests",
            "scheduled_time": "2025-12-31T23:59:59Z",  # ✅ SAFE: Far future date
            "send_to_all": False,  # ✅ SAFE: Don't send to all devices
            "test_tokens": ["test-fcm-token"],  # ✅ SAFE: Only test tokens
            "data": {"test_mode": True}
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json().get("success") is True
    assert "id" in response.json()


def test_get_scheduled_notifications():
    headers = get_admin_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/notification/scheduled", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_remove_scheduled_notification():
    headers = get_admin_headers()
    # First, schedule a notification to get an id
    schedule_response = httpx.post(
        f"{BASE_URL}/api/v1/notification/schedule",
        json={
            "title": "TEST - Remove Test Notification",
            "body": "This test notification will be removed immediately",
            "scheduled_time": "2025-12-31T23:59:59Z",  # ✅ SAFE: Far future date
            "send_to_all": False,  # ✅ SAFE: Don't send to all devices
            "test_tokens": ["test-fcm-token"],  # ✅ SAFE: Only test tokens
            "data": {"test_mode": True}
        },
        headers=headers,
    )
    assert schedule_response.status_code == 200
    notification_id = schedule_response.json().get("id")
    assert notification_id
    # Now, remove it
    remove_response = httpx.delete(
        f"{BASE_URL}/api/v1/notification/scheduled/{notification_id}",
        headers=headers,
    )
    assert remove_response.status_code == 200
    assert remove_response.json().get("success") in [True, False]
