from backend.get_bearer_token import generate_test_token

def get_auth_headers():
    token = generate_test_token()
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
