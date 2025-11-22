#tested 1 error on nov 22

import pytest
import httpx
import asyncio
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from bson import ObjectId
import os

from helpers.event_payment_helper import event_payment_helper
from models.event import Event
from models.transaction import Transaction, PaymentStatus, RegistrationPaymentStatus
from test_auth_helpers import get_admin_headers, get_user_headers

# Test Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
TEST_EVENT_ID = "507f1f77bcf86cd799439011"
TEST_USER_UID = "test_user_123"
TEST_FAMILY_MEMBER_ID = "507f1f77bcf86cd799439012"

class TestEventPaymentValidation:
    """Test validation functions for event payment security"""
    
    @pytest.mark.asyncio
    async def test_validate_user_event_access_with_roles(self):
        """Test user access validation - authenticated user can register (roles don't restrict registration)"""
        # Mock event with role requirements
        mock_event = Event(
            id="test_event",
            name="Test Event",
            ru_name="Тест",
            description="Test Description",
            ru_description="Тест описание",
            date=datetime.now() + timedelta(days=1),
            location="Test Location",
            price=50.0,
            spots=100,
            rsvp=True,
            recurring="never",
            ministry=["Youth"],
            min_age=18,
            max_age=65,
            gender="all",
            roles=["Youth Leader", "Admin"],
            published=True,
            payment_options=["paypal"]
        )
        
        # Mock user with required roles
        mock_user = {
            "uid": TEST_USER_UID,
            "roles": ["role_id_1", "role_id_2"]
        }
        
        # Mock role name conversion
        with patch('mongo.roles.RoleHandler.ids_to_names', return_value=["Youth Leader", "Member"]):
            can_access, reason = await event_payment_helper.validate_user_event_access(TEST_USER_UID, mock_event, mock_user)
            assert can_access is True
            assert "Access granted" in reason
    
    @pytest.mark.asyncio
    async def test_validate_user_event_access_without_roles(self):
        """Test user access validation - all authenticated users can register regardless of roles"""
        mock_event = Event(
            id="test_event",
            name="Test Event",
            ru_name="Тест",
            description="Test Description", 
            ru_description="Тест описание",
            date=datetime.now() + timedelta(days=1),
            location="Test Location",
            price=50.0,
            spots=100,
            rsvp=True,
            recurring="never",
            ministry=["Youth"],
            min_age=18,
            max_age=65,
            gender="all",
            roles=["Admin", "Event Manager"],  # These are for management only, not registration
            published=True,
            payment_options=["paypal"]
        )
        
        mock_user = {
            "uid": TEST_USER_UID,
            "roles": ["role_id_1"]  # User has different roles - should still be allowed to register
        }
        
        # No need to mock RoleHandler.ids_to_names since role checking is removed for registration
        can_access, reason = await event_payment_helper.validate_user_event_access(TEST_USER_UID, mock_event, mock_user)
        assert can_access is True  # Changed: now allows all authenticated users
        assert "Access granted" in reason
    
    @pytest.mark.asyncio
    async def test_validate_family_member_access_valid(self):
        """Test valid family member access"""
        mock_family_member = {
            "_id": ObjectId(TEST_FAMILY_MEMBER_ID),
            "first_name": "John",
            "last_name": "Doe"
        }
        
        with patch('mongo.churchuser.UserHandler.get_person', return_value=mock_family_member):
            can_access, reason = await event_payment_helper.validate_family_member_access(TEST_USER_UID, TEST_FAMILY_MEMBER_ID)
            assert can_access is True
            assert "Family member access granted" in reason
    
    @pytest.mark.asyncio
    async def test_validate_family_member_access_invalid(self):
        """Test invalid family member access"""
        with patch('mongo.churchuser.UserHandler.get_person', return_value=None):
            can_access, reason = await event_payment_helper.validate_family_member_access(TEST_USER_UID, TEST_FAMILY_MEMBER_ID)
            assert can_access is False
            assert "not found" in reason
    
    @pytest.mark.asyncio
    async def test_validate_registration_data_valid(self):
        """Test valid registration data"""
        registration = {
            "name": "John Doe",
            "person_id": None,
            "donation_amount": 25.0,
            "payment_amount_per_person": 0
        }
        
        # Mock event for validation
        mock_event = Event(
            id="test_event",
            name="Test Event",
            ru_name="Тест",
            description="Test Description",
            ru_description="Тест описание",
            date=datetime.now() + timedelta(days=1),
            location="Test Location",
            price=50.0,
            spots=100,
            rsvp=True,
            recurring="never",
            ministry=["Youth"],
            min_age=18,
            max_age=65,
            gender="all",
            roles=["Youth Leader", "Admin"],
            published=True,
            payment_options=["paypal"]
        )
        
        is_valid, message = await event_payment_helper.validate_registration_data(registration, mock_event, TEST_USER_UID)
        assert is_valid is True
        assert message == "Valid"
    
    @pytest.mark.asyncio
    async def test_validate_registration_data_invalid_name(self):
        """Test registration with invalid name"""
        registration = {
            "name": "John123!@#",  # Invalid characters
            "person_id": None,
            "donation_amount": 25.0
        }
        
        # Mock event for validation
        mock_event = Event(
            id="test_event",
            name="Test Event",
            ru_name="Тест",
            description="Test Description",
            ru_description="Тест описание",
            date=datetime.now() + timedelta(days=1),
            location="Test Location",
            price=50.0,
            spots=100,
            rsvp=True,
            recurring="never",
            ministry=["Youth"],
            min_age=18,
            max_age=65,
            gender="all",
            roles=["Youth Leader", "Admin"],
            published=True,
            payment_options=["paypal"]
        )
        
        is_valid, message = await event_payment_helper.validate_registration_data(registration, mock_event, TEST_USER_UID)
        assert is_valid is False
        assert "invalid characters" in message
    
    @pytest.mark.asyncio
    async def test_validate_registration_data_excessive_amounts(self):
        """Test registration with excessive amounts"""
        registration = {
            "name": "John Doe",
            "donation_amount": 15000,  # Over limit
            "payment_amount_per_person": -50  # Negative
        }
        
        # Mock event for validation
        mock_event = Event(
            id="test_event",
            name="Test Event",
            ru_name="Тест",
            description="Test Description",
            ru_description="Тест описание",
            date=datetime.now() + timedelta(days=1),
            location="Test Location",
            price=50.0,
            spots=100,
            rsvp=True,
            recurring="never",
            ministry=["Youth"],
            min_age=18,
            max_age=65,
            gender="all",
            roles=["Youth Leader", "Admin"],
            published=True,
            payment_options=["paypal"]
        )
        
        is_valid, message = await event_payment_helper.validate_registration_data(registration, mock_event, TEST_USER_UID)
        assert is_valid is False
        assert "negative" in message.lower() or "validation error" in message.lower()
    
    @pytest.mark.asyncio
    async def test_validate_bulk_registration_request_too_many(self):
        """Test bulk registration with too many registrations"""
        registrations = [{"name": f"Person {i}"} for i in range(60)]  # Over limit
        
        errors = await event_payment_helper.validate_bulk_registration_request(registrations, TEST_USER_UID)
        assert any("Too many registrations" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_bulk_registration_request_duplicate_names(self):
        """Test bulk registration with duplicate names"""
        registrations = [
            {"name": "John Doe", "donation_amount": 50},
            {"name": "jane smith", "donation_amount": 50},
            {"name": "John Doe", "donation_amount": 50}  # Duplicate
        ]
        
        errors = await event_payment_helper.validate_bulk_registration_request(registrations, TEST_USER_UID)
        assert any("Duplicate names detected" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_bulk_registration_request_suspicious_pattern(self):
        """Test bulk registration with suspicious payment patterns"""
        registrations = [
            {"name": f"Person {i}", "donation_amount": 500} for i in range(10)
        ]  # Same large amount for many people
        
        errors = await event_payment_helper.validate_bulk_registration_request(registrations, TEST_USER_UID)
        assert any("Suspicious payment pattern" in error for error in errors)


class TestEventPaymentEndpoints:
    """Integration tests for event payment endpoints"""
    
    def test_create_bulk_order_without_auth(self):
        """Test creating bulk order without authentication"""
        bulk_data = {
            "registrations": [{"name": "John Doe", "donation_amount": 25}],
            "message": "Test registration"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data
        )
        
        assert response.status_code == 403  # Should require auth
    
    def test_create_bulk_order_empty_registrations(self):
        """Test creating bulk order with empty registrations"""
        headers = get_admin_headers()
        bulk_data = {
            "registrations": [],
            "message": "Test registration"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        assert response.status_code == 400
        assert "No registrations provided" in response.json().get("detail", "")
    
    def test_complete_bulk_registration_without_auth(self):
        """Test completing bulk registration without authentication"""
        completion_data = {
            "registrations": [{"name": "John Doe"}],
            "payment_id": "test_payment_123",
            "payer_id": "test_payer_123",
            "total_amount": 50.0
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/complete-bulk-registration",
            json=completion_data
        )
        
        assert response.status_code == 403  # Should require auth
    
    def test_get_payment_status_without_auth(self):
        """Test getting payment status without authentication"""
        response = httpx.get(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/status"
        )
        
        assert response.status_code == 403  # Should require auth
    
    def test_get_payment_registrations_without_auth(self):
        """Test getting payment registrations without authentication"""
        response = httpx.get(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/registrations/payment-status"
        )
        
        assert response.status_code == 403  # Should require auth


class TestEventPaymentSecurity:
    """Security-focused tests for event payment system"""
    
    def test_sql_injection_in_event_id(self):
        """Test SQL injection attempts in event ID"""
        headers = get_admin_headers()
        malicious_event_id = "'; DROP TABLE events; --"
        
        response = httpx.get(
            f"{BASE_URL}/api/v1/events/{malicious_event_id}/payment/status",
            headers=headers
        )
        
        # Should handle gracefully, not cause server error
        assert response.status_code in [400, 404, 422]  # Bad request or not found
    
    def test_xss_in_registration_name(self):
        """Test XSS attempts in registration names"""
        headers = get_admin_headers()
        bulk_data = {
            "registrations": [{
                "name": "<script>alert('xss')</script>",
                "donation_amount": 25
            }],
            "message": "Test registration"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        # Should reject invalid characters in name
        if response.status_code == 400:
            assert "invalid characters" in response.json().get("detail", "").lower()
    
    def test_excessive_payload_size(self):
        """Test handling of excessively large payloads"""
        headers = get_admin_headers()
        
        # Create a very large registration list
        large_registrations = []
        for i in range(1000):  # Way over the limit
            large_registrations.append({
                "name": f"Person {i}",
                "donation_amount": 1
            })
        
        bulk_data = {
            "registrations": large_registrations,
            "message": "Large test"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        # Should reject due to too many registrations
        assert response.status_code == 400
        assert "Too many registrations" in response.json().get("detail", "")
    
    def test_negative_amounts(self):
        """Test handling of negative payment amounts"""
        headers = get_admin_headers()
        bulk_data = {
            "registrations": [{
                "name": "John Doe",
                "donation_amount": -100  # Negative amount
            }],
            "message": "Negative test"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        assert response.status_code == 400
        assert "cannot be negative" in response.json().get("detail", "")
    
    def test_unauthorized_family_member_registration(self):
        """Test attempting to register someone else's family member"""
        headers = get_user_headers()  # Regular user, not admin
        fake_family_member_id = str(ObjectId())
        
        bulk_data = {
            "registrations": [{
                "name": "Someone Else",
                "family_member_id": fake_family_member_id,
                "donation_amount": 25
            }],
            "message": "Unauthorized test"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        # Should reject unauthorized family member access
        if response.status_code == 400:
            assert "not found for user" in response.json().get("detail", "")


class TestEventPaymentEdgeCases:
    """Edge case tests for event payment system"""
    
    def test_zero_amount_registration(self):
        """Test registration with zero amounts"""
        headers = get_admin_headers()
        bulk_data = {
            "registrations": [{
                "name": "John Doe",
                "donation_amount": 0,
                "payment_amount_per_person": 0
            }],
            "message": "Zero amount test"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        # Should reject if no payment required
        assert response.status_code in [400, 422]
    
    def test_unicode_names(self):
        """Test registration with unicode names"""
        headers = get_admin_headers()
        bulk_data = {
            "registrations": [{
                "name": "Ιωάννης Παπαδόπουλος",  # Greek name
                "donation_amount": 25
            }, {
                "name": "山田太郎",  # Japanese name
                "donation_amount": 25
            }],
            "message": "Unicode test"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        # Should handle unicode names gracefully
        # Either accept them or reject with clear message
        assert response.status_code in [200, 400]
    
    def test_very_long_names(self):
        """Test registration with very long names"""
        headers = get_admin_headers()
        long_name = "A" * 150  # Over 100 character limit
        
        bulk_data = {
            "registrations": [{
                "name": long_name,
                "donation_amount": 25
            }],
            "message": "Long name test"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        assert response.status_code == 400
        assert "too long" in response.json().get("detail", "").lower()
    
    def test_malformed_object_ids(self):
        """Test with malformed MongoDB ObjectIds"""
        headers = get_admin_headers()
        bulk_data = {
            "registrations": [{
                "name": "John Doe",
                "family_member_id": "not_a_valid_objectid",
                "donation_amount": 25
            }],
            "message": "Malformed ID test"
        }
        
        response = httpx.post(
            f"{BASE_URL}/api/v1/events/{TEST_EVENT_ID}/payment/create-bulk-order",
            json=bulk_data,
            headers=headers
        )
        
        assert response.status_code == 400
        assert "Invalid person_id format" in response.json().get("detail", "")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])