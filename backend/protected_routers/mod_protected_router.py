from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import Callable, Optional

from helpers.Firebase_helpers import authenticate_uid
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler

async def _attach_mod_user_to_state(
    request: Request,
    uid: str = Depends(authenticate_uid),
) -> str:
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
