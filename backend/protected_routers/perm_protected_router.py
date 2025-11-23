from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import Callable, List, Optional, Sequence, Union
import os

from helpers.Firebase_helpers import authenticate_uid
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler

# Check if E2E test mode is enabled
E2E_TEST_MODE = os.getenv("E2E_TEST_MODE", "").lower() == "true"

def _normalize_required_perms(required_perms: Optional[Union[str, Sequence[str]]]) -> List[str]:
    if required_perms is None:
        return []
    if isinstance(required_perms, str):
        required_perms = [required_perms]
    seen = set()
    out: List[str] = []
    for p in required_perms:
        if p is None:
            continue
        s = str(p).strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out

def _make_perm_dependency(required_perms: List[str]) -> Callable:
    async def _dep(request: Request, uid: str = Depends(authenticate_uid)) -> str:
        # Bypass MongoDB user check and permission validation in E2E test mode
        if E2E_TEST_MODE and uid == "e2e-test-user-id":
            # Create a fake user with all permissions for E2E testing
            fake_user = {
                "uid": uid,
                "email": "e2e-test@example.com",
                "roles": ["admin"]
            }
            # Grant all permissions for testing
            fake_perms = {perm: True for perm in required_perms}
            # Also add common permissions
            fake_perms.update({
                "sermon_editing": True,
                "bulletin_editing": True,
                "event_editing": True,
                "user_management": True,
                "admin": True
            })
            
            request.state.uid = uid
            request.state.user = fake_user
            request.state.roles = ["admin"]
            request.state.perms = fake_perms
            request.state.required_perms = required_perms
            return uid

        user = await UserHandler.find_by_uid(uid)
        if user is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found in MongoDB")

        roles = user.get("roles", [])
        if not isinstance(roles, list) or len(roles) == 0:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no roles assigned")

        user_perms = await RoleHandler.infer_permissions(roles)

        missing = [perm for perm in required_perms if not bool(user_perms.get(perm))]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permissions: {', '.join(missing)}",
            )
        request.state.uid = uid
        request.state.user = user
        request.state.roles = roles
        request.state.perms = user_perms
        request.state.required_perms = required_perms

        return uid
    return _dep

# This router has a dependency that the user must be logged in and authenticated with firebase.
# Furthermore, it requires validation with mongodb that the user must be present on our db
# Finally, it allows you to state a list of required permissions that the user must have.
# You want to use this router if you have a requirement that the user is a "Mod" type user that can see the admin dashboard AND has particular permissions.
class PermProtectedRouter(APIRouter):
    def __init__(
        self,
        *args,
        required_perms: Optional[Union[str, Sequence[str]]] = None,
        perm_dependency: Optional[Callable] = None,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        normalized = _normalize_required_perms(required_perms)
        dep = perm_dependency or _make_perm_dependency(normalized)
        self.dependencies.append(Depends(dep))
        self.state = {
            "auth": "firebase_required",
            "mod": "mongo_user_with_roles>=1",
            "perm": {"all_required": normalized},
            "exposes": ["uid", "user", "roles", "perms", "required_perms"],
        }
