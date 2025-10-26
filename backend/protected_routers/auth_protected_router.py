from fastapi import APIRouter, Depends, Request, HTTPException, status
from typing import Callable, Optional
from helpers.Firebase_helpers import authenticate_uid, ensure_user_for_dev_token
from mongo.churchuser import UserHandler

async def _attach_uid_to_state(request: Request, uid: str = Depends(authenticate_uid)) -> str:
    """
    Verifies Firebase token (via authenticate_uid) and attaches uid to request.state.
    Returning uid allows other dependencies to chain if desired.
    """
    request.state.uid = uid

    user = await UserHandler.find_by_uid(uid)
    if user is None:
        user = await ensure_user_for_dev_token(request, uid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not found in MongoDB",
        )
    
    request.state.user = user

    return uid


# This Router has a dependency that the user must be authenticated to proceed, this is a login of any type.
# User does not necessarilly need to have permissions or be admin at this level, merely be logged in on any account.
# Verifies with firebase and mongodb
class AuthProtectedRouter(APIRouter):
    """
    A router that enforces Firebase auth for every route included and stores
    the authenticated uid on request.state.uid.

    Designed to act as "pseudo-middleware" without needing per-endpoint Depends.
    """
    def __init__(
        self,
        *args,
        auth_dependency: Optional[Callable] = None,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        dep = auth_dependency or _attach_uid_to_state
        self.dependencies.append(Depends(dep))
        self.state = {"auth": "firebase_required", "exposes":["uid", "user"]}
