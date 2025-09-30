from dotenv import load_dotenv
import httpx
import pytest
import sys
import os

from backend.tests.test_auth_helpers import get_admin_headers

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_dir)

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL")


def test_create_order():
    headers = get_admin_headers()
    response = httpx.post(f"{BASE_URL}/api/v1/paypal/orders", json={"amount": "10.00", "currency": "USD"}, headers=headers)
    assert response.status_code in [200, 400]
    assert "id" in response.json() or "error" in response.json()


def test_capture_order():
    pytest.skip("Skipping capture order test: requires real PayPal approval flow and payer_id.")


def test_get_transaction_by_id():
    transaction_id = "test-transaction-id"
    headers = get_admin_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/paypal/transaction/{transaction_id}", headers=headers)
    assert response.status_code in [200, 404]


def test_create_subscription():
    headers = get_admin_headers()
    response = httpx.post(f"{BASE_URL}/api/v1/paypal/subscription", json={"plan_id": "test-plan-id"}, headers=headers)
    assert response.status_code in [200, 400]
    assert "id" in response.json() or "error" in response.json()


def test_execute_subscription():
    token = "test-approval-token"
    headers = get_admin_headers()
    response = httpx.post(f"{BASE_URL}/api/v1/paypal/subscription/execute", params={"token": token}, headers=headers)
    assert response.status_code in [200, 400, 404]


def test_get_fund_purposes():
    headers = get_admin_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/paypal/fund-purposes", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
