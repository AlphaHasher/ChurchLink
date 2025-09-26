from fastapi.testclient import TestClient
from dotenv import load_dotenv
import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_dir)

from main import app
from get_bearer_token import generate_test_token

load_dotenv()

client = TestClient(app)


def get_auth_headers():
    email = os.getenv("TESTING_AUTH_EMAIL")
    password = os.getenv("TESTING_AUTH_PASSWORD")
    if not email or not password:
        raise ValueError("TESTING_AUTH_EMAIL or TESTING_AUTH_PASSWORD not found in .env file")

    token = generate_test_token(email=email, password=password, save_to_file=False)
    return {
        "Authorization": f"Bearer {token}",
        "accept": "application/json"
    }


def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello World"}


def test_create_plan():
    headers = get_auth_headers()
    print(headers)
    response = client.post(
        "/api/v1/bible-plans/",
        json={"name": "Test Plan", "description": "A test reading plan", "days": []},
        headers=headers,
    )
    assert response.status_code == 201
    assert "id" in response.json()


def test_list_plans():
    headers = get_auth_headers()
    response = client.get("/api/v1/bible-plans/", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_bible_plan_templates():
    headers = get_auth_headers()
    response = client.get("/api/v1/bible-plans/templates", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_bible_plan_template_by_id():
    headers = get_auth_headers()
    response = client.get("/api/v1/bible-plans/templates/id/test-template-id", headers=headers)
    assert response.status_code in [200, 404]  # Template may or may not exist


def test_get_bible_plan_template_by_name():
    headers = get_auth_headers()
    response = client.get("/api/v1/bible-plans/templates/test-template-name", headers=headers)
    assert response.status_code in [200, 404]  # Template may or may not exist


def test_get_user_plans():
    headers = get_auth_headers()
    response = client.get("/api/v1/bible-plans/user/test-user-id", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_plan():
    headers = get_auth_headers()
    response = client.get("/api/v1/bible-plans/test-plan-id", headers=headers)
    assert response.status_code in [200, 404]  # Plan may or may not exist


def test_update_plan():
    headers = get_auth_headers()
    response = client.put(
        "/api/v1/bible-plans/test-plan-id",
        json={"name": "Updated Plan", "description": "Updated description", "days": []},
        headers=headers,
    )
    assert response.status_code in [200, 404]  # Plan may or may not exist


def test_remove_plan():
    headers = get_auth_headers()
    response = client.delete("/api/v1/bible-plans/test-plan-id", headers=headers)
    assert response.status_code in [200, 404]  # Plan may or may not exist


if __name__ == "__main__":
    # Generate token for test user
    generate_test_token()