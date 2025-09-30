from fastapi import APIRouter, Request
from controllers.permissions_functions import fetch_perms, create_role, RoleCreateInput, RoleUpdateInput, UserRoleUpdateInput, update_role, delete_role, update_user_roles

permissions_view_router = APIRouter(prefix="/permissions", tags=["permissions"])

permissions_protected_router = APIRouter(prefix="/permissions", tags=["permissions"])


###################
# Update Request

# Mod Router
@permissions_view_router.get("/get-permissions")
async def process_get_permissions(request:Request):
    return await fetch_perms()

# Perm Router - permissions_management
@permissions_protected_router.post("/create-role")
async def process_role_creation(payload: RoleCreateInput, request:Request):
    return await create_role(payload, request)

# Perm Router - permissions_management
@permissions_protected_router.patch("/update-role")
async def process_role_update(payload: RoleUpdateInput, request:Request):
    return await update_role(payload, request)

# Perm Router - permissions_management
@permissions_protected_router.delete("/delete-role")
async def process_role_delete(payload: RoleUpdateInput, request:Request):
    return await delete_role(payload, request)

# Perm Router - permissions_management
@permissions_protected_router.patch("/update-user-roles")
async def process_user_role_update(payload: UserRoleUpdateInput, request:Request):
    return await update_user_roles(payload, request)
