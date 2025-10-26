from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from firebase_admin import auth
from pydantic import BaseModel
from fastapi.security import HTTPBearer
from typing import List, Callable
import os
from dotenv import load_dotenv

load_dotenv()


security = HTTPBearer()

class FirebaseUser:
    def __init__(self, uid: str, email: str, roles: List[str]):
        self.uid = uid
        self.email = email
        self.roles = roles

class Token(BaseModel):
    access_token: str
    token_type: str


##this so we can disable dev tokens in production
ALLOW_DEV_TOKENS = os.getenv("ALLOW_DEV_TOKENS") == "1"



## we can the user details in the dev token itself
def _parse_dev_token(token: str):
    """
    Accepts tokens of the form:
      dev:<uid>:<email>[:role1,role2]
    Returns dict with uid, email, roles or None if not a dev token/disabled.
    """
    if not (ALLOW_DEV_TOKENS and token.startswith("dev:")):
        return None
    parts = token.split(":", 3)
    uid = parts[1] if len(parts) > 1 and parts[1] else "test-uid"
    email = parts[2] if len(parts) > 2 else ""
    roles: List[str] = []
    if len(parts) > 3 and parts[3]:
        roles = [r.strip() for r in parts[3].split(",") if r.strip()]
    return {"uid": uid, "email": email, "roles": roles}


def make_dev_token(email: str, roles: list[str] | str | None = None, uid: str | None = None) -> str:
    """
    Build a dev token compatible with the backend bypass.
    Format: dev:<uid>:<email>[:role1,role2]
    """
    local_part = (email or "user").split("@")[0]
    uid_val = uid or f"{local_part}-uid"
    if roles:
        if isinstance(roles, str):
            roles_part = roles
        else:
            roles_part = ",".join([r for r in roles if r])
        return f"dev:{uid_val}:{email}:{roles_part}"
    return f"dev:{uid_val}:{email}"


async def authenticate_uid(credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        # The token comes in the format "Bearer <token>"
        token = credentials.credentials
        # dev bypass 
        dev = _parse_dev_token(token)
        if dev:
            return dev["uid"]
        # Verify the token with Firebase Admin SDK
        decoded_token = auth.verify_id_token(token)
        
        # Get user claims to check
        uid = decoded_token['uid']
        return uid
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> FirebaseUser:
    """
    Validate Firebase ID token and verify the user has access to the resource
    """
    try:
        # The token comes in the format "Bearer <token>"
        token = credentials.credentials
        # dev bypass 
        dev = _parse_dev_token(token)
        if dev:
            ##just make a user object with the roles from the token
            return FirebaseUser(uid=dev["uid"], email=dev["email"], roles=dev["roles"])

        # Verify the token with Firebase Admin SDK
        decoded_token = auth.verify_id_token(token)

        # Get user claims to check
        uid = decoded_token['uid']
        user = auth.get_user(uid)
        
        # Check email
        email = user.email if user.email else decoded_token.get('email', '')
        
        # Get custom claims
        custom_claims = user.custom_claims or {}
        roles = custom_claims.get('roles', [])
        
        # Create user object
        firebase_user = FirebaseUser(uid=uid, email=email, roles=roles)
        
            
        return firebase_user
        
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
            # trust roles from dev token if present
            authz = request.headers.get("authorization") or request.headers.get("Authorization")
            roles: List[str]
            if authz and authz.lower().startswith("bearer "):
                bearer = authz.split(None, 1)[1]
                if _parse_dev_token(bearer):
                    roles = current_user.roles or []
                else:
                    user = auth.get_user(current_user.uid)
                    custom_claims = user.custom_claims or {}
                    roles = custom_claims.get('roles', [])
            else:
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
    except Exception:
        return None


# create user from dev token if in request and puts it in mongo if it doesn't exist
async def ensure_user_for_dev_token(request: Request, uid: str):
    if not ALLOW_DEV_TOKENS:
        return None
    try:
        from mongo.churchuser import UserHandler
        from mongo.roles import RoleHandler
    except Exception:
        return None

    authz = request.headers.get("authorization") or request.headers.get("Authorization")
    if not (authz and authz.lower().startswith("bearer ")):
        return None
    token = authz.split(None, 1)[1]
    dev = _parse_dev_token(token)
    if not (dev and dev["uid"] == uid):
        return None

    user = await UserHandler.find_by_uid(uid)
    if user is not None and user is not False:
        return user

    email = dev["email"] or f"{uid}@test.local"
    roles = dev["roles"] or []
    await UserHandler.create_user(
        first_name="Test",
        last_name="User",
        email=email,
        uid=uid,
        roles=roles,
        verified=True,
    )

    created = await UserHandler.find_by_uid(uid)
    if created:
        return created

    try:
        existing_by_email_list = await UserHandler.find_by_email(email)
    except Exception:
        existing_by_email_list = []
    existing_by_email = existing_by_email_list[0] if existing_by_email_list else None
    if existing_by_email:
        try:
            role_ids = await RoleHandler.names_to_ids(roles)
        except Exception:
            role_ids = []
        update = {"uid": uid, "verified": True}
        if role_ids:
            update["roles"] = role_ids
        await UserHandler.update_user({"email": email}, update)
        return await UserHandler.find_by_uid(uid)

    return None


