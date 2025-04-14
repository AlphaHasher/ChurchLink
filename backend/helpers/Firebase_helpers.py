from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from firebase_admin import auth
from pydantic import BaseModel
from fastapi.security import HTTPBearer
from typing import List, Callable
from fastapi import Depends, Request


security = HTTPBearer()

class FirebaseUser:
    def __init__(self, uid: str, email: str, roles: List[str]):
        self.uid = uid
        self.email = email
        self.roles = roles

class Token(BaseModel):
    access_token: str
    token_type: str


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> FirebaseUser:
    """
    Validate Firebase ID token and verify the user has access to the resource
    """
    try:
        # The token comes in the format "Bearer <token>"
        token = credentials.credentials
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


def permission_required(required_permissions: list):
    """
    Dependency generator to enforce permission-based access control in FastAPI routes.

    This function checks if the authenticated user (based on their Firebase token) has the required permissions
    for a given route. It does this by:
    - Extracting the user's roles from the Firebase token.
    - Looking up each role's permissions from the MongoDB `roles` collection.
    - Ensuring that all `required_permissions` are present in the user's aggregated permission set.

    Usage:
        @router.get("/example", dependencies=[permission_required(["edit_page"])])
        async def example_endpoint():
            ...

    Notes:
    - This function should be used when fine-grained permission control is needed beyond just role-based access.
    - Make sure the `roles` collection in the DB contains permission lists for each role.
    """
    async def permission_checker(request: Request = Depends(), current_user: FirebaseUser = Depends(get_current_user)):
        user_roles = current_user.roles if current_user else []
        user_permissions = set()

        # For each role, fetch the associated permissions from your database or config
        # Here, we assume you have a function `get_permissions_for_role` that retrieves them
        from mongo.database import DB
        for role in user_roles:
            role_doc = await DB.roles.find_one({"name": role})
            if role_doc:
                role_permissions = role_doc.get("permissions", [])
                user_permissions.update(role_permissions)

        if not all(p in user_permissions for p in required_permissions):
            raise HTTPException(status_code=403, detail="Permission denied")
    return Depends(permission_checker)