from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from firebase_admin import auth
from pydantic import BaseModel
from fastapi.security import HTTPBearer
from typing import List, Callable
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory (parent of helpers directory)
backend_dir = Path(__file__).parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Allow requests without Authorization header to reach our handler so we can bypass in E2E mode
security = HTTPBearer(auto_error=False)

# Check if E2E test mode is enabled (for Cypress tests)
E2E_TEST_MODE = os.getenv("E2E_TEST_MODE", "").lower() == "true"

# Check if testing tokens are accepted (for development admin bypass)
ACCEPT_TESTING_TOKENS = os.getenv("ACCEPT_TESTING_TOKENS", "").lower() == "true"

# Debug logging for testing token acceptance
logger = logging.getLogger(__name__)
# Log the actual value to debug
raw_value = os.getenv("ACCEPT_TESTING_TOKENS", "NOT_SET")
logger.info(f"ACCEPT_TESTING_TOKENS raw value: '{raw_value}'")
logger.info(f"ACCEPT_TESTING_TOKENS enabled: {ACCEPT_TESTING_TOKENS}")
if ACCEPT_TESTING_TOKENS:
    logger.info("ACCEPT_TESTING_TOKENS is enabled - testing tokens will be accepted")
else:
    logger.warning(f"ACCEPT_TESTING_TOKENS is disabled. Check .env file at: {env_path}")

class FirebaseUser:
    def __init__(self, uid: str, email: str, roles: List[str]):
        self.uid = uid
        self.email = email
        self.roles = roles

class Token(BaseModel):
    access_token: str
    token_type: str




async def authenticate_uid(credentials: HTTPAuthorizationCredentials = Security(security)):
    # Bypass Firebase authentication entirely in E2E test mode
    if E2E_TEST_MODE:
        return "e2e-test-user-id"

    # Outside test mode, enforce presence of a valid Bearer token
    token = credentials.credentials if credentials else None
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization: Bearer token")

    # Log the token for debugging (first 50 chars only for security)
    logger.info(f"Received token (first 50 chars): {token[:50]}...")
    logger.info(f"ACCEPT_TESTING_TOKENS enabled: {ACCEPT_TESTING_TOKENS}")

    # Check for testing token format: TESTING_TOKEN:email:uid
    if ACCEPT_TESTING_TOKENS:
        if token.startswith("TESTING_TOKEN:"):
            try:
                parts = token.split(":", 2)
                logger.info(f"Token parts count: {len(parts)}, parts: {parts}")
                if len(parts) == 3 and parts[1] == "admin@testing.com":
                    # Extract real UID from the token
                    # Format: TESTING_TOKEN:admin@testing.com:VMjpZUqtBlS9RA01Flwk2Dmm7kH2
                    uid = parts[2]
                    logger.info(f"Testing token accepted for UID: {uid}")
                    return uid
                else:
                    logger.warning(f"Testing token format invalid: expected admin@testing.com, got {parts[1] if len(parts) > 1 else 'N/A'}")
            except Exception as e:
                # Log error but fall through to normal Firebase verification
                logger.warning(f"Error parsing testing token: {e}", exc_info=True)
                pass  # Fall through to normal Firebase verification
        else:
            logger.warning(f"Token does not start with TESTING_TOKEN:. Token starts with: {token[:30] if len(token) > 30 else token}")
            logger.warning(f"Full token length: {len(token)}")

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token['uid']
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> FirebaseUser:
    """
    Validate Firebase ID token and verify the user has access to the resource
    """
    # In E2E mode, return a mocked Administrator user and skip Firebase entirely
    if E2E_TEST_MODE:
        return FirebaseUser(uid="e2e-test-user-id", email="e2e-test@example.com", roles=["admin"])

    # Enforce token outside test mode
    token = credentials.credentials if credentials else None
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization: Bearer token")

    # Check for testing token format: TESTING_TOKEN:email:uid
    if ACCEPT_TESTING_TOKENS and token.startswith("TESTING_TOKEN:"):
        try:
            parts = token.split(":", 2)
            if len(parts) == 3 and parts[1] == "admin@testing.com":
                # Extract real UID from token
                # Format: TESTING_TOKEN:admin@testing.com:VMjpZUqtBlS9RA01Flwk2Dmm7kH2
                uid = parts[2]
                # Return admin user for testing (using real UID)
                return FirebaseUser(uid=uid, email="admin@testing.com", roles=["admin"])
        except Exception:
            pass  # Fall through to normal Firebase verification

    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        user = auth.get_user(uid)

        email = user.email if user.email else decoded_token.get('email', '')
        custom_claims = user.custom_claims or {}
        roles = custom_claims.get('roles', [])

        return FirebaseUser(uid=uid, email=email, roles=roles)
    except auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase ID token has been revoked. Please sign in again.")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase ID token has expired. Please sign in again.")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token. Please sign in again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error validating Firebase ID token: {str(e)}")
    

def role_based_access(required_roles: List[str]) -> Callable:
    """
    Factory function to create a dependency that checks if the user has the required roles.
    """
    async def check_role(request: Request, current_user: FirebaseUser = Depends(get_current_user)) -> None:
        """
        Dependency that checks if the user has the required roles in their custom claims.
        """
        try:
            # In E2E mode, short-circuit all role checks
            if E2E_TEST_MODE:
                request.state.current_user = current_user
                return

            user = auth.get_user(current_user.uid)
            custom_claims = user.custom_claims or {}
            roles = custom_claims.get('roles', [])

            # Check if all required roles are present
            missing_roles = [role for role in required_roles if role not in roles]

            # If user has developer role, grant access to all roles
            if "developer" in roles:
                missing_roles = []

            if missing_roles:
                raise HTTPException(
                    status_code=403,
                    detail=f"User does not have the required roles: {', '.join(missing_roles)}"
                )
            # Store the user in the request state so it can be accessed in endpoints
            request.state.current_user = current_user

        except auth.UserNotFoundError:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error retrieving user claims: {str(e)}"
            )
    return check_role

async def get_uid_by_email(email: str) -> str:
    """
    Get Firebase UID by email address.
    """
    try:
        user = auth.get_user_by_email(email)
        return user.uid
    except auth.UserNotFoundError:
        return None
    except Exception as e:
        return None


