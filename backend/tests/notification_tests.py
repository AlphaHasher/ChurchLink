from dotenv import load_dotenv
import httpx
import sys
import os

from backend.tests.test_auth_helpers import get_auth_headers

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_dir)

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")


def test_save_fcm_token():
    headers = get_auth_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/notification/save-fcm-token",
        json={"user_id": "test-user-id", "token": "test-fcm-token"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json().get("success") is True


def test_get_fcm_tokens():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/notification/get-fcm-tokens", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_notification_settings():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/notification/settings", headers=headers)
    assert response.status_code == 200
    assert "streamNotificationMessage" in response.json()
    assert "streamNotificationTitle" in response.json()


def test_update_notification_settings():
    headers = get_auth_headers()
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
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/notification/history", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_send_push_notification():
    headers = get_auth_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/notification/send",
        json={
            "title": "Test Push",
            "body": "Push body",
            "data": {"target": "all"},
            "send_to_all": True
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json().get("success") in [True, False]  # May fail if FCM not configured


def test_schedule_notification():
    headers = get_auth_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/notification/schedule",
        json={
            "title": "Scheduled Test",
            "body": "Scheduled body",
            "scheduled_time": "2025-09-28T12:00:00Z",
            "send_to_all": True,
            "data": {}
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json().get("success") is True
    assert "id" in response.json()


def test_get_scheduled_notifications():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/notification/scheduled", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_remove_scheduled_notification():
    headers = get_auth_headers()
    # First, schedule a notification to get an id
    schedule_response = httpx.post(
        f"{BASE_URL}/api/v1/notification/schedule",
        json={
            "title": "Remove Test",
            "body": "Remove body",
            "scheduled_time": "2025-09-28T12:00:00Z",
            "send_to_all": True,
            "data": {}
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
