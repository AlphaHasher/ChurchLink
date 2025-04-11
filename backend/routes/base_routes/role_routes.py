from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from bson import ObjectId

# Import models and functions from models/roles.py
from models.roles import (
    RoleCreate, RoleOut, PermissionSchema,
    create_role, get_role_by_id, get_role_by_name,
    update_role, delete_role, get_roles_with_permissions
)

role_router = APIRouter(prefix="/roles", tags=["Roles"])

@role_router.post(
    "/",
    response_model=RoleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new role"
)
async def create_role_route(role_data: RoleCreate):
    """
    Creates a new role with the given name and permissions.
    - **name**: Unique name for the role.
    - **permissions**: A dictionary defining permission states (e.g., `{"admin": true, "finance": false}`).
    """
    created_role = await create_role(role_data)
    if not created_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with name '{role_data.name}' might already exist or another error occurred."
        )
    return created_role

@role_router.get(
    "/id/{role_id}",
    response_model=RoleOut,
    summary="Get role by ID"
)
async def get_role_by_id_route(role_id: str):
    """
    Retrieves a specific role by its unique MongoDB ObjectId string.
    """
    try:
        # Validate ObjectId format early
        ObjectId(role_id)
    except Exception:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ObjectId format: {role_id}")

    role = await get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role with ID '{role_id}' not found")
    return role

@role_router.get(
    "/name/{role_name}",
    response_model=RoleOut,
    summary="Get role by name"
)
async def get_role_by_name_route(role_name: str):
    """
    Retrieves a specific role by its unique name.
    """
    role = await get_role_by_name(role_name)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role with name '{role_name}' not found")
    return role

@role_router.get(
    "/with-permissions/",
    response_model=List[RoleOut],
    summary="Find roles containing specific permissions"
)
async def get_roles_with_permissions_route(
    permission_names: List[str] = Query(..., description="List of permission keys (e.g., 'admin', 'finance') the roles must have.")
):
    """
    Finds all roles that have *all* the specified permissions set to `true`.
    Provide permission names as query parameters, e.g., `?permission_names=admin&permission_names=event_management`.
    """
    if not permission_names:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No permission names provided")
    roles = await get_roles_with_permissions(permission_names)
    # No exception if list is empty, just return []
    return roles

@role_router.put(
    "/{role_id}",
    summary="Update role by ID"
    # Consider response_model for consistency, e.g., a simple {"success": bool} or the updated RoleOut
)
async def update_role_route(role_id: str, role_update_data: RoleCreate):
    """
    Updates an existing role specified by its ID.
    Replaces the existing name and permissions with the provided data.
    - **role_id**: The ID of the role to update.
    - **role_update_data**: The new data for the role (name and permissions).
    """
    try:
        ObjectId(role_id)
    except Exception:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ObjectId format: {role_id}")

    success = await update_role(role_id, role_update_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID '{role_id}' not found, or update failed (e.g., name conflict)."
        )
    # Optionally fetch and return the updated role
    # updated_role = await get_role_by_id(role_id)
    # return updated_role
    return {"message": f"Role '{role_id}' updated successfully", "success": True}

@role_router.delete(
    "/{role_id}",
    summary="Delete role by ID"
)
async def delete_role_route(role_id: str):
    """
    Deletes a role specified by its unique ID.
    """
    try:
        ObjectId(role_id)
    except Exception:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ObjectId format: {role_id}")

    success = await delete_role(role_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role with ID '{role_id}' not found")
    return {"message": f"Role '{role_id}' deleted successfully", "success": True}
