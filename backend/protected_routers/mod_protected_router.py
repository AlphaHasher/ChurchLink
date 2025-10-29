from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import Callable, Optional
import os

from helpers.Firebase_helpers import authenticate_uid
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler

# Check if E2E test mode is enabled
E2E_TEST_MODE = os.getenv("E2E_TEST_MODE", "").lower() == "true"

async def _attach_mod_user_to_state(
    request: Request,
    uid: str = Depends(authenticate_uid),
) -> str:
    # Bypass MongoDB user check in E2E test mode
    if E2E_TEST_MODE and uid == "e2e-test-user-id":
        # Set minimal test user state with Administrator role only
        request.state.uid = uid
        request.state.user = {
            "uid": uid,
            "email": "e2e-test@example.com",
            "roles": ["admin"]  # Administrator role for testing
        }
        request.state.roles = ["admin"]
        request.state.perms = ["all"]  # Grant all permissions for testing
        return uid
    
    user = await UserHandler.find_by_uid(uid)
    if not user or user is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not found in MongoDB",
        )

    roles = user.get("roles", [])
    if not isinstance(roles, list) or len(roles) == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no roles assigned",
        )

    perms = await RoleHandler.infer_permissions(roles)

    request.state.uid = uid
    request.state.user = user
    request.state.roles = roles
    request.state.perms = perms

    return uid

# This router has a dependency that the user must be logged in and authenticated with firebase.
# Furthermore, it requires validation with mongodb that the user must be present on our db
# Finally, it specifies a requirement that the user has at least 1 permission role.
# You want to use this router if you have a requirement that the user is a "Mod" type user that can see the admin dashboard.
class ModProtectedRouter(APIRouter):
    def __init__(
        self,
        *args,
        mod_dependency: Optional[Callable] = None,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        dep = mod_dependency or _attach_mod_user_to_state
        self.dependencies.append(Depends(dep))
        self.state = {
            "auth": "firebase_required",
            "mod": "mongo_user_with_roles>=1",
            "exposes": ["uid", "user", "roles", "perms"],
        }
