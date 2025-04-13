from fastapi import APIRouter
from models.permissions_functions import fetch_perms, create_role, RoleCreateInput, RoleUpdateInput, UserRoleUpdateInput, update_role, delete_role, update_user_roles

permissions_router = APIRouter()

###################
# Update Request


# TODO: this DEFINITELY needs middleware
@permissions_router.get("/get-permissions")
async def process_get_permissions():
    return await fetch_perms()

# TODO: This also needs middleware
@permissions_router.post("/create-role")
async def process_role_creation(payload: RoleCreateInput):
    return await create_role(payload)

@permissions_router.patch("/update-role")
async def process_role_update(payload:RoleUpdateInput):
    return await update_role(payload)

@permissions_router.delete("/delete-role")
async def process_role_delete(payload:RoleUpdateInput):
    return await delete_role(payload)

@permissions_router.patch("/update-user-roles")
async def process_user_role_update(payload:UserRoleUpdateInput):
    return await update_user_roles(payload)
