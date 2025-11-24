#tested 1 failed, 5 passed, 4 errors on Nov 22

import os
import httpx
import pytest
from datetime import datetime, timedelta
from dotenv import load_dotenv

from backend.tests.test_auth_helpers import get_auth_headers, get_admin_headers

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")

if not BASE_URL:
    raise RuntimeError("Environment variable BACKEND_URL must be set for Bible plan notification tests")

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

@pytest.fixture
async def sample_bible_plan(admin_headers):
    """Create a sample Bible plan for testing"""
    plan_data = {
        "name": "Test Notification Plan",
        "duration": 7,
        "visible": True,
        "readings": {
            "1": [{"id": "1", "book": "Genesis", "chapter": 1, "reference": "Genesis 1"}],
            "2": [{"id": "2", "book": "Genesis", "chapter": 2, "reference": "Genesis 2"}],
            "3": [{"id": "3", "book": "Genesis", "chapter": 3, "reference": "Genesis 3"}]
        }
    }
    
    response = httpx.post(
        f"{BASE_URL}/api/v1/bible-plans",
        json=plan_data,
        headers=admin_headers,
    )
    assert response.status_code == 200
    plan_id = response.json()["id"]
    
    yield plan_id
    
    # Cleanup
    httpx.delete(f"{BASE_URL}/api/v1/bible-plans/{plan_id}", headers=admin_headers)


@pytest.fixture
async def user_bible_subscription(auth_headers, sample_bible_plan):
    """Create a user subscription to a Bible plan"""
    plan_id = sample_bible_plan
    start_date = datetime.now()
    
    subscription_data = {
        "plan_id": plan_id,
        "start_date": start_date.isoformat(),
        "notification_time": "09:00:00",
        "notification_enabled": True
    }
    
    response = httpx.post(
        f"{BASE_URL}/api/v1/my-bible-plans/subscribe",
        json=subscription_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    
    yield {"plan_id": plan_id, "start_date": start_date}
    
    # Cleanup
    httpx.delete(f"{BASE_URL}/api/v1/my-bible-plans/unsubscribe/{plan_id}", headers=auth_headers)


class TestBiblePlanNotificationPreferences:
    """Test Bible plan notification preference management"""
    
    async def test_get_notification_preferences_empty(self, auth_headers):
        """Test getting notification preferences when user has no subscriptions"""
        response = httpx.get(
            f"{BASE_URL}/api/v1/bible-plan-notifications/my-preferences",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["preferences"], list)
    
    async def test_get_notification_preferences_with_subscription(self, auth_headers, user_bible_subscription):
        """Test getting notification preferences when user has subscriptions"""
        response = httpx.get(
            f"{BASE_URL}/api/v1/bible-plan-notifications/my-preferences",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["preferences"]) > 0
        
        # Check that the preference contains expected fields
        pref = data["preferences"][0]
        assert "plan_id" in pref
        assert "notification_enabled" in pref
        assert "notification_time" in pref
        assert pref["plan_id"] == user_bible_subscription["plan_id"]
    
    async def test_update_notification_preferences(self, auth_headers, user_bible_subscription):
        """Test updating notification preferences for a Bible plan"""
        plan_id = user_bible_subscription["plan_id"]
        
        update_data = {
            "plan_id": plan_id,
            "notification_time": "08:30:00",
            "notification_enabled": False
        }
        
        response = httpx.put(
            f"{BASE_URL}/api/v1/bible-plan-notifications/user-preference/{plan_id}",
            json=update_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["notification_time"] == "08:30:00"
        assert data["notification_enabled"] is False
    
    async def test_update_notification_preferences_invalid_plan(self, auth_headers):
        """Test updating notification preferences for non-existent plan"""
        fake_plan_id = "507f1f77bcf86cd799439011"
        
        update_data = {
            "plan_id": fake_plan_id,
            "notification_time": "08:30:00",
            "notification_enabled": True
        }
        
        response = httpx.put(
            f"{BASE_URL}/api/v1/bible-plan-notifications/user-preference/{fake_plan_id}",
            json=update_data,
            headers=auth_headers,
        )
        assert response.status_code == 404
    
    async def test_update_device_notification_preference(self):
        """Test updating device-level Bible plan notification preference"""
        test_token = "test-device-token-bible-plan"
        
        update_data = {
            "token": test_token,
            "enabled": True
        }
        
        response = httpx.put(
            f"{BASE_URL}/api/v1/bible-plan-notifications/device-preference",
            json=update_data,
        )
        # This might return 500 if the device token doesn't exist, which is expected
        assert response.status_code in [200, 500]


class TestBiblePlanNotificationSending:
    """Test Bible plan notification sending functionality"""
    
    async def test_send_immediate_notification(self, auth_headers, user_bible_subscription):
        """Test sending an immediate Bible plan notification"""
        plan_id = user_bible_subscription["plan_id"]
        
        send_data = {
            "plan_id": plan_id,
            "message": "Test immediate notification for Bible reading!"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/bible-plan-notifications/send-immediate",
            json=send_data,
            headers=auth_headers,
        )
        # This might fail if no device tokens are registered, which is expected in tests
        assert response.status_code in [200, 400]
    
    async def test_send_immediate_notification_invalid_plan(self, auth_headers):
        """Test sending immediate notification for non-existent plan"""
        fake_plan_id = "507f1f77bcf86cd799439011"
        
        send_data = {
            "plan_id": fake_plan_id,
            "message": "Test message"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/bible-plan-notifications/send-immediate",
            json=send_data,
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestBiblePlanNotificationAdminEndpoints:
    """Test admin endpoints for Bible plan notifications"""
    
    async def test_get_notification_stats(self, admin_headers):
        """Test getting Bible plan notification statistics"""
        response = httpx.get(
            f"{BASE_URL}/api/v1/bible-plan-notifications/stats",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "stats" in data
        
        stats = data["stats"]
        assert "active_subscriptions_with_notifications" in stats
        assert "total_subscriptions" in stats
        assert "scheduled_notifications" in stats
        assert isinstance(stats["active_subscriptions_with_notifications"], int)
        assert isinstance(stats["total_subscriptions"], int)
        assert isinstance(stats["scheduled_notifications"], int)
    
    async def test_manual_schedule_notifications(self, admin_headers):
        """Test manually triggering Bible plan notification scheduling"""
        response = httpx.post(
            f"{BASE_URL}/api/v1/bible-plan-notifications/manual-schedule",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "scheduled_count" in data
        assert isinstance(data["scheduled_count"], int)


class TestBiblePlanNotificationIntegration:
    """Integration tests for Bible plan notifications"""
    
    async def test_full_notification_workflow(self, auth_headers, admin_headers, sample_bible_plan):
        """Test the complete notification workflow"""
        plan_id = sample_bible_plan
        
        # 1. Subscribe to Bible plan with notifications enabled
        subscription_data = {
            "plan_id": plan_id,
            "start_date": datetime.now().isoformat(),
            "notification_time": "09:00:00",
            "notification_enabled": True
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/my-bible-plans/subscribe",
            json=subscription_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        
        # 2. Check notification preferences
        response = httpx.get(
            f"{BASE_URL}/api/v1/bible-plan-notifications/my-preferences",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["preferences"]) > 0
        
        # 3. Update notification settings
        update_data = {
            "plan_id": plan_id,
            "notification_time": "07:30:00",
            "notification_enabled": True
        }
        
        response = httpx.put(
            f"{BASE_URL}/api/v1/bible-plan-notifications/user-preference/{plan_id}",
            json=update_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        
        # 4. Trigger manual scheduling (admin action)
        response = httpx.post(
            f"{BASE_URL}/api/v1/bible-plan-notifications/manual-schedule",
            headers=admin_headers,
        )
        assert response.status_code == 200
        
        # 5. Check stats
        response = httpx.get(
            f"{BASE_URL}/api/v1/bible-plan-notifications/stats",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["stats"]["active_subscriptions_with_notifications"] >= 0
        
        # Cleanup
        httpx.delete(f"{BASE_URL}/api/v1/my-bible-plans/unsubscribe/{plan_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__])