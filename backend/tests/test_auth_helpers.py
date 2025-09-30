import os
import requests
from get_bearer_token import generate_test_token
from dotenv import load_dotenv

FIREBASE_WEB_API_KEY = os.environ.get("FIREBASE_WEB_API_KEY")
FIREBASE_AUTH_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"

AUTH_EMAIL = os.environ.get("TESTING_AUTH_EMAIL")
AUTH_PASSWORD = os.environ.get("TESTING_AUTH_PASSWORD")
ADMIN_EMAIL = os.environ.get("TESTING_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TESTING_ADMIN_PASSWORD")

def token_from_email_password(email: str, password: str) -> str:
    """
    Sign in to Firebase with email+password and return idToken (JWT).
    Raises RuntimeError on failure.
    """
    payload = {
        "email": email,
        "password": password,
        "returnSecureToken": True  # ensures idToken + refreshToken returned
    }
    resp = requests.post(FIREBASE_AUTH_URL, json=payload, timeout=10)
    if not resp.ok:
        # include response text for debugging (be cautious with logs)
        raise RuntimeError(f"Firebase sign-in failed: {resp.status_code} {resp.text}")
    data = resp.json()
    # data contains: idToken, refreshToken, expiresIn, localId, email
    return data["idToken"]

def get_auth_headers():
    token = token_from_email_password(AUTH_EMAIL, AUTH_PASSWORD)
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

def get_admin_headers():
    token = token_from_email_password(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }


