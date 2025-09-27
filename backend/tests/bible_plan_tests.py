
from dotenv import load_dotenv
import httpx
import sys
import os

from backend.tests.test_auth_helpers import get_auth_headers

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_dir)

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL") 


def test_create_plan():
    headers = get_auth_headers()
    response = httpx.post(
        f"{BASE_URL}/api/v1/bible-plans/",
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
                        "reference": "Genesis 1:1-5"
                    }
                ]
            }
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert "id" in response.json()
    
    # Delete the created plan
    plan_id = response.json()["id"]
    delete_response = httpx.delete(f"{BASE_URL}/api/v1/bible-plans/{plan_id}", headers=headers)
    assert delete_response.status_code == 200

def test_list_plans():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/bible-plans/", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_bible_plan_templates():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/bible-plans/templates", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_bible_plan_template_by_id():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/bible-plans/templates/id/test-template-id", headers=headers)
    assert response.status_code in [200, 404]  # Template may or may not exist


def test_get_bible_plan_template_by_name():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/bible-plans/templates/test-template-name", headers=headers)
    assert response.status_code in [200, 404]  # Template may or may not exist


def test_get_user_plans():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/bible-plans/user/test-user-id", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_plan():
    headers = get_auth_headers()
    response = httpx.get(f"{BASE_URL}/api/v1/bible-plans/test-plan-id", headers=headers)
    assert response.status_code in [200, 404]  # Plan may or may not exist - later we can create a plan and test against that


def test_update_plan():
    headers = get_auth_headers()
    response = httpx.put(
        f"{BASE_URL}/api/v1/bible-plans/test-plan-id",
        json={"name": "Updated Plan", "description": "Updated description", "days": []},
        headers=headers,
    )
    assert response.status_code in [200, 404]  # Plan may or may not exist
