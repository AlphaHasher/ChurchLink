import pytest  # noqa: F401
try:
	from helpers.Firebase_helpers import make_dev_token
except Exception:
	def make_dev_token(email: str, roles=None, uid: str | None = None) -> str:
		local_part = (email or "user").split("@")[0]
		uid_val = uid or f"{local_part}-uid"
		if roles:
			if isinstance(roles, str):
				roles_part = roles
			else:
				roles_part = ",".join([r for r in roles if r])
			return f"dev:{uid_val}:{email}:{roles_part}"
		return f"dev:{uid_val}:{email}"

# Hardcoded test user emails
AUTH_EMAIL = "noadmin@testing.com"
ADMIN_EMAIL = "admin@testing.com"

def _dev_token_for(email: str, roles: str | None = None, uid: str | None = None) -> str:
    """
    Wrapper to build a dev token using shared helper.
    roles may be a comma-separated string; we accept both str and list.
    """
    if roles is None:
        return make_dev_token(email)
    # pass through string or convert to list
    if isinstance(roles, str):
        roles_list = roles.split(",")
    else:
        roles_list = roles
    return make_dev_token(email, roles_list, uid)

# Define default bearer tokens here (not from .env)
TEST_USER_BEARER = _dev_token_for(AUTH_EMAIL)
TEST_ADMIN_BEARER = _dev_token_for(ADMIN_EMAIL, roles="Administrator")


def get_auth_headers():
    # Use dev token defined in this file by default
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_USER_BEARER}"
    }

def get_admin_headers():
    # Use dev token defined in this file by default
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_ADMIN_BEARER}"
    }


def get_user_headers():
	"""Alias for get_auth_headers for consistency"""
	return get_auth_headers()


