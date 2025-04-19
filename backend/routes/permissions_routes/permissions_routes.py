from fastapi import APIRouter, Depends
from models.permissions_functions import fetch_perms, create_role, RoleCreateInput, RoleUpdateInput, UserRoleUpdateInput, update_role, delete_role, update_user_roles
from helpers.Firebase_helpers import authenticate_uid

permissions_router = APIRouter()

###################
# Update Request


@permissions_router.get("/get-permissions")
async def process_get_permissions(uid: str = Depends(authenticate_uid)):
    return await fetch_perms(uid)

@permissions_router.post("/create-role")
async def process_role_creation(payload: RoleCreateInput, uid: str = Depends(authenticate_uid)):
    return await create_role(payload)

@permissions_router.patch("/update-role")
async def process_role_update(payload: RoleUpdateInput, uid: str = Depends(authenticate_uid)):
    return await update_role(payload)

@permissions_router.delete("/delete-role")
async def process_role_delete(payload: RoleUpdateInput, uid: str = Depends(authenticate_uid)):
    return await delete_role(payload)

@permissions_router.patch("/update-user-roles")
async def process_user_role_update(payload: UserRoleUpdateInput, uid: str = Depends(authenticate_uid)):
    return await update_user_roles(payload)
