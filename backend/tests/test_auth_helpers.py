import os
import requests
import pytest
from backend.get_bearer_token import generate_test_token
from dotenv import load_dotenv

load_dotenv()

FIREBASE_WEB_API_KEY = os.environ.get("FIREBASE_WEB_API_KEY")
if not FIREBASE_WEB_API_KEY:
	raise RuntimeError("Environment variable FIREBASE_WEB_API_KEY must be set for auth tests")

FIREBASE_AUTH_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"

# Hardcoded test user emails
AUTH_EMAIL = "noadmin@testing.com"
ADMIN_EMAIL = "admin@testing.com"

# Password is FIREBASE_WEB_API_KEY + "!"
AUTH_PASSWORD = FIREBASE_WEB_API_KEY + "!"
ADMIN_PASSWORD = FIREBASE_WEB_API_KEY + "!"

def _env_bearer(*env_names: str) -> str | None:
	for name in env_names:
		token = os.environ.get(name)
		if token:
			return token
	return None

def token_from_email_password(email: str, password: str) -> str:
	"""
	Sign in to Firebase with email+password and return idToken (JWT).
	Skips tests gracefully if Firebase reports quota exceeded.
	"""
	payload = {
		"email": email,
		"password": password,
		"returnSecureToken": True  # ensures idToken + refreshToken returned
	}
	resp = requests.post(FIREBASE_AUTH_URL, json=payload, timeout=10)
	if not resp.ok:
		try:
			data = resp.json()
			msg = (data.get("error") or {}).get("message", "")
			if "QUOTA_EXCEEDED" in msg:
				pytest.skip("Firebase password auth quota exceeded; provide TEST_USER_BEARER/TEST_ADMIN_BEARER env tokens to run.")
		except Exception:
			pass
		# include response text for debugging (be cautious with logs)
		raise RuntimeError(f"Firebase sign-in failed: {resp.status_code} {resp.text}")
	data = resp.json()
	# data contains: idToken, refreshToken, expiresIn, localId, email
	return data["idToken"]

def get_auth_headers():
	# Prefer env-provided bearer to avoid hitting Firebase in CI
	env_token = _env_bearer("TEST_USER_BEARER", "AUTH_BEARER_TOKEN_USER", "BACKEND_TEST_USER_TOKEN")
	if env_token:
		return {
			"Content-Type": "application/json",
			"Authorization": f"Bearer {env_token}"
		}
	# Fallback to live sign-in
	token = token_from_email_password(AUTH_EMAIL, AUTH_PASSWORD)
	return {
		"Content-Type": "application/json",
		"Authorization": f"Bearer {token}"
	}

def get_admin_headers():
	# Prefer env-provided bearer to avoid hitting Firebase in CI
	env_token = _env_bearer("TEST_ADMIN_BEARER", "AUTH_BEARER_TOKEN_ADMIN", "BACKEND_TEST_ADMIN_TOKEN")
	if env_token:
		return {
			"Content-Type": "application/json",
			"Authorization": f"Bearer {env_token}"
		}
	# Fallback to live sign-in
	token = token_from_email_password(ADMIN_EMAIL, ADMIN_PASSWORD)
	return {
		"Content-Type": "application/json",
		"Authorization": f"Bearer {token}"
	}


