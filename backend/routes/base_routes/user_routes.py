from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, Body
from pydantic import EmailStr
from bson import ObjectId
from datetime import datetime # Import datetime if needed for birthday query

# Import models and functions from models/user.py
from models.user import (
    UserCreate, UserOut, AddressSchema, # Assuming AddressSchema might be needed for updates
    create_user, get_user_by_id, get_user_by_email,
    find_users_with_role_id, find_users_with_permissions,
    find_users_by_first_name, find_users_by_last_name,
    update_user_roles, delete_user, find_users_by_age
)

# Assuming RoleOut might be needed if fetching roles associated with users
# from models.roles import RoleOut

user_router = APIRouter(prefix="/users", tags=["Users"])

# --- User Creation ---
@user_router.post(
    "/",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user"
)
async def create_user_route(user_data: UserCreate = Body(...)):
    """
    Creates a new user.
    - **email**: Must be unique.
    - **roles**: Provide a list of *role names* (e.g., `["Administrator", "Event Manager"]`). These will be converted to ObjectIds.
    - Other fields like phone, birthday, address are optional.
    """
    # The user_data model already includes validation via Pydantic/EmailStr
    created_user = await create_user(user_data)
    if not created_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user_data.email}' might already exist, or a provided role name was invalid, or another error occurred."
        )
    return created_user

# --- User Retrieval ---
@user_router.get(
    "/id/{user_id}",
    response_model=UserOut,
    summary="Get user by ID"
)
async def get_user_by_id_route(user_id: str):
    """
    Retrieves a specific user by their unique MongoDB ObjectId string.
    """
    try:
        ObjectId(user_id)
    except Exception:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ObjectId format: {user_id}")

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found")
    return user

@user_router.get(
    "/email/{user_email}",
    response_model=UserOut,
    summary="Get user by email"
)
async def get_user_by_email_route(user_email: EmailStr):
    """
    Retrieves a specific user by their unique email address.
    """
    user = await get_user_by_email(user_email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with email '{user_email}' not found")
    return user

# --- User Search/Filtering ---
@user_router.get(
    "/with-role/{role_id}",
    response_model=List[UserOut],
    summary="Find users by role ID"
)
async def find_users_with_role_id_route(role_id: str):
    """
    Finds all users who are assigned the specified role ID.
    """
    try:
        ObjectId(role_id)
    except Exception:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ObjectId format for role ID: {role_id}")

    users = await find_users_with_role_id(role_id)
    # Return empty list if none found, no error needed
    return users

@user_router.get(
    "/with-permissions/",
    response_model=List[UserOut],
    summary="Find users having roles with specific permissions"
)
async def find_users_with_permissions_route(
    permission_names: List[str] = Query(..., description="List of permission keys (e.g., 'admin', 'finance') the user's roles must grant.")
):
    """
    Finds all users who have *at least one role* that grants *all* the specified permissions.
    Provide permission names as query parameters, e.g., `?permission_names=admin&permission_names=event_management`.
    """
    if not permission_names:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No permission names provided")
    users = await find_users_with_permissions(permission_names)
    return users

@user_router.get(
    "/by-name/",
    response_model=List[UserOut],
    summary="Find users by first or last name"
)
async def find_users_by_name_route(first_name: Optional[str] = None, last_name: Optional[str] = None):
    """
    Finds users matching the provided first name and/or last name.
    - Provide `first_name` query parameter to search by first name.
    - Provide `last_name` query parameter to search by last name.
    - If both are provided, it might require a specific model function (find_by_full_name) or adjusted logic.
      (Current implementation will likely use find_by_first_name or find_by_last_name depending on which is called last if both provided, needs refinement for combined search)
    """
    users = []
    if first_name:
        users = await find_users_by_first_name(first_name)
    elif last_name: # Use elif to avoid overwriting if first_name was also provided and matched
        users = await find_users_by_last_name(last_name)
    else:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide 'first_name' or 'last_name' query parameter.")
    # Consider adding find_by_full_name if needed for AND condition
    return users

@user_router.get(
    "/by-age/{age}",
    response_model=List[UserOut],
    summary="Find users by exact age"
)
async def find_users_by_age_route(age: int):
    """
    Finds users who are currently the specified age based on their birthday.
    """
    if age < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Age must be non-negative")
    users = await find_users_by_age(age)
    return users


# --- User Modification ---
@user_router.put(
    "/{user_email}/roles",
    summary="Update user roles by email"
)
async def update_user_roles_route(user_email: EmailStr, role_names: List[str] = Body(..., embed=True)):
    """
    Updates the roles assigned to a user specified by their email.
    Replaces the user's current roles with the list provided.
    - **user_email**: Email of the user to update.
    - **role_names**: A list of *role names* to assign to the user.
    """
    success = await update_user_roles(user_email, role_names)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, # Or 400 if a role name was invalid
            detail=f"User with email '{user_email}' not found, or one of the role names was invalid."
        )
    return {"message": f"Roles for user '{user_email}' updated successfully", "success": True}

# --- User Deletion ---
@user_router.delete(
    "/{user_id}",
    summary="Delete user by ID"
)
async def delete_user_route(user_id: str):
    """
    Deletes a user specified by their unique ID.
    """
    try:
        ObjectId(user_id)
    except Exception:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ObjectId format: {user_id}")

    success = await delete_user(user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found")
    return {"message": f"User '{user_id}' deleted successfully", "success": True}

# TODO: Add endpoints for updating user profile details (name, phone, address, birthday)
# This would likely require a new Pydantic model for partial updates (e.g., UserUpdate)
# and a corresponding model function (e.g., update_user_profile).
