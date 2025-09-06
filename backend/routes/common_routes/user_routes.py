from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, Body, Depends
from pydantic import EmailStr
from bson import ObjectId
from datetime import datetime # Import datetime if needed for birthday query

# Import models and functions from models/user.py
from helpers.Firebase_helpers import authenticate_uid
from models.user import (
    UserCreate, UserOut, AddressSchema, # Assuming AddressSchema might be needed for updates
    create_user, get_user_by_id, get_user_by_email,
    get_users,
    find_users_with_permissions,
    update_user_roles, delete_user
)
from models.users_functions import fetch_users, process_sync_by_uid, get_my_permissions, MyPermsRequest

# Basic user function helpers
from backend.helpers.RouteParameterHelper import validate_route_ids, validate_family_member_data

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

# --- Updated Route for Listing/Filtering Multiple Users --- 
@user_router.get(
    "/",
    response_model=List[UserOut],
    summary="List users or find by various criteria"
)
async def get_users_route(
    first_name: Optional[str] = Query(None, description="Filter by first name (exact match)"),
    last_name: Optional[str] = Query(None, description="Filter by last name (exact match)"),
    age: Optional[int] = Query(None, description="Filter by current age"),
    role_id: Optional[str] = Query(None, description="Filter by assigned role ID (ObjectId string)"),
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: Optional[int] = Query(100, ge=1, description="Maximum number of records to return (default 100)")
):
    """
    Lists users or finds users matching the provided optional query parameters.
    If no filter parameters are provided, lists all users (paginated).
    Supports pagination with `skip` and `limit`.
    """
    # Call the updated function with query parameters (email removed)
    users = await get_users(
        first_name=first_name,
        last_name=last_name,
        age=age,
        role_id=role_id,
        skip=skip,
        limit=limit
    )
    return users

# --- Permission-based search route remains separate --- 
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


@user_router.post("/sync-user")
async def process_sync_request(uid: str = Depends(authenticate_uid)):
    return await process_sync_by_uid(uid)
    

@user_router.get("/get-users")
async def process_get_users(uid: str = Depends(authenticate_uid)):
    return await fetch_users(uid)

@user_router.post("/get-my-permissions")
async def process_get_my_permissions(payload: MyPermsRequest, uid: str = Depends(authenticate_uid)):
    return await get_my_permissions(payload, uid)

#
# --- Family Member Routes  ---
#

# Add family member
@user_router.post("/{user_id}/family-members", response_model=dict, status_code=status.HTTP_201_CREATED, summary="Add a new family member to user account")
async def add_family_member_to_user_route(user_id: str, family_member_data: dict = Body(...), uid: str = Depends(authenticate_uid)):
    try: # throws any errors raised during validation
        
        # validate id's
        validate_route_ids(user_id=user_id, uid=uid)
        # validate data
        validated_data = validate_family_member_data(family_member_data)

        # TODO: Add member to database with family member valid data
        family_member = None
        return {"success": True, "family_member": family_member}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error adding family member: {str(e)}")

# Get ALL family members
@user_router.get("/{user_id}/family-members", response_model=dict, summary="Get all family members associated with user account")
async def get_user_family_members_route(user_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        from backend.helpers.RouteParameterHelper import validate_route_ids
        # validate id's
        validate_route_ids(user_id=user_id, uid=uid)

        # TODO:
        family_members = [] # Get family members from database
        return {"success": True, "family_members": family_members}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family members: {str(e)}")

# Get specific family member
@user_router.get("/{user_id}/family-members/{family_member_id}", response_model=dict, summary="Get specific family member details")
async def get_user_family_member_route(user_id: str, family_member_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        from backend.helpers.RouteParameterHelper import validate_route_ids
        # validate id's
        validate_route_ids(user_id=user_id, family_member_id=family_member_id, uid=uid)

        # TODO: Get specific family member from database
        family_member = None
        return {"success": True, "family_member": family_member}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family member: {str(e)}")

# Update family member
@user_router.put("/{user_id}/family-members/{family_member_id}", response_model=dict, summary="Update family member information")
async def update_user_family_member_route(user_id: str, family_member_id: str, family_member_data: dict = Body(...), uid: str = Depends(authenticate_uid)):
    try: 
        from backend.helpers.RouteParameterHelper import validate_route_ids, validate_family_member_data
        # validate id's
        validate_route_ids(user_id=user_id, family_member_id=family_member_id, uid=uid)
        # validate data
        validated_data = validate_family_member_data(family_member_data)

        # TODO: Update member in database with validated data
        success = True
        return {"success": success, "message": "Family member updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error updating family member: {str(e)}")

# Remove family member
@user_router.delete("/{user_id}/family-members/{family_member_id}", response_model=dict, summary="Remove family member from account")
async def delete_user_family_member_route(user_id: str, family_member_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        from backend.helpers.RouteParameterHelper import validate_route_ids
        # validate id's
        validate_route_ids(user_id=user_id, family_member_id=family_member_id, uid=uid)

        # TODO: Delete family member from database
        success = True
        return {"success": success, "message": "Family member deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error deleting family member: {str(e)}")