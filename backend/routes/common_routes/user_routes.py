from typing import Literal
from fastapi import APIRouter, HTTPException, status, Query, Body, Request

# Import models and functions from models/user.py
from models.user import ( PersonCreate, PersonUpdateRequest,
    add_family_member, get_family_members, get_family_member_by_id, update_family_member, delete_family_member, get_user_by_uid, get_user_by_id
)
from controllers.users_functions import fetch_users, process_sync_by_uid, get_my_permissions, fetch_profile_info, update_profile, get_is_init, update_contact, search_users_paged, fetch_detailed_user, execute_patch_detailed_user, UsersSearchParams, search_logical_users_paged, MyPermsRequest, PersonalInfo, ContactInfo, DetailedUserInfo, fetch_users_with_role_id, delete_user_account, check_if_user_is_admin, process_fetch_all_people
from mongo.database import DB
from mongo.roles import RoleHandler

from controllers.event_controllers.event_registration_controller import unregister_family_member_across_upcoming, unregister_user_across_upcoming

user_private_router = APIRouter(prefix="/users", tags=["Users"])
user_mod_router = APIRouter(prefix="/users", tags=["Users"])

# Private Router
@user_private_router.post("/sync-user")
async def process_sync_request(request:Request):
    return await process_sync_by_uid(request)

# Private Router
@user_private_router.get("/get-profile")
async def process_get_profile(request:Request):
    return await fetch_profile_info(request)

# Private Router
@user_private_router.patch("/update-profile")
async def process_update_profile(request:Request, profile_data: PersonalInfo = Body(...)):
    return await update_profile(request.state.uid, profile_data)

# Private Route
@user_private_router.patch("/update-contact")
async def process_update_contact(request:Request, contact_info: ContactInfo = Body(...)):
    return await update_contact(request.state.uid, contact_info)

# Private Router
@user_private_router.get("/is-init")
async def process_is_init(request: Request):
    return await get_is_init(request)

# Mod Router
@user_mod_router.get("/check-mod")
async def process_check_mod(request:Request):
    if isinstance(request.state.roles, list) and len(request.state.roles) > 0:
        return {'success':True}
    else:
        return {'success':False}

# Private Router - Get current user's permissions
@user_private_router.get("/permissions")
async def get_user_permissions(request: Request):
    """Get the current user's computed permissions"""
    try:
        # Get user from request state (set by AuthProtectedRouter)
        user = getattr(request.state, 'user', None)
        if not user:
            return {'success': False, 'permissions': {}, 'msg': 'User not found in request state'}
        
        # Get user roles and compute permissions
        user_roles = user.get('roles', [])
        if not user_roles:
            # User has no roles - return empty permissions
            user_perms = RoleHandler.permission_template.copy()
        else:
            # Compute permissions from roles
            user_perms = await RoleHandler.infer_permissions(user_roles)
        
        return {'success': True, 'permissions': user_perms}
    except Exception as e:
        return {'success': False, 'permissions': {}, 'msg': f'Error fetching permissions: {str(e)}'}

# Mod Router
@user_mod_router.get("/get-users")
async def process_get_users(request:Request):
    return await fetch_users()

#Mod Router
@user_mod_router.get("/get-users-with-role/{role_id}")
async def get_users_with_role(request:Request, role_id:str):
    return await fetch_users_with_role_id(role_id)

# Mod Router
@user_mod_router.get("/get-detailed-user/{uid}")
async def get_detailed_user(request:Request, uid:str):
    return await fetch_detailed_user(uid)

# Mod Router
@user_mod_router.patch("/detailed-user/{uid}")
async def patch_detailed_user(request:Request, uid:str, details: DetailedUserInfo = Body(...)):
    return await execute_patch_detailed_user(uid, details)

# Mod Router
# Intelligent searching for users table.
@user_mod_router.get("/search-users")
async def process_search_users(
    request: Request,
    page: int = Query(0, ge=0),
    pageSize: int = Query(25, ge=1, le=200),
    searchField: Literal["email", "name"] = Query("email"),
    searchTerm: str = Query("", description="Case-insensitive contains"),
    sortBy: Literal["email", "name", "createdOn", "uid", "membership"] = Query("createdOn"),
    sortDir: Literal["asc", "desc"] = Query("asc")
):
    params = UsersSearchParams(
        page=page, pageSize=pageSize,
        searchField=searchField, searchTerm=searchTerm,
        sortBy=sortBy, sortDir=sortDir
    )
    return await search_users_paged(params)

# Mod Router
# Search specifically for logical perm table.
@user_mod_router.get("/search-logical-users")
async def process_search_logical_users(
    request: Request,
    page: int = Query(0, ge=0),
    pageSize: int = Query(25, ge=1, le=200),
    searchField: Literal["email", "name"] = Query("name"),
    searchTerm: str = Query("", description="Case-insensitive contains"),
    sortBy: Literal["email", "name", "createdOn", "uid", "membership"] = Query("name"),
    sortDir: Literal["asc", "desc"] = Query("asc")
):
    params = UsersSearchParams(
        page=page, pageSize=pageSize,
        searchField=searchField, searchTerm=searchTerm,
        sortBy=sortBy, sortDir=sortDir,
        hasRolesOnly=True
    )
    return await search_logical_users_paged(params)

# Mod Router
@user_mod_router.get("/get-user/{user_id}")
async def process_get_user(user_id: str, request:Request):
    return await get_user_by_id(user_id)

# Get user by uid
@user_mod_router.get("/get-user-by-uid/{uid}")
async def process_get_user_by_uid(uid: str, request:Request):
    return await get_user_by_uid(uid)

# Mod Router
@user_mod_router.post("/get-my-permissions")
async def process_get_my_permissions(payload: MyPermsRequest, request:Request):
    return await get_my_permissions(payload, request)

#
# --- Family Member Routes ---
#

# Private Router
# Add family member
@user_private_router.post("/add-family-member", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_family_member_to_user_route(request: Request, family_member_data: PersonCreate = Body(...)):
    try:
        user_id = request.state.uid
        
        created_member = await add_family_member(user_id, family_member_data)
        if not created_member:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error adding family member")
        
        return {"success": True, "family_member": created_member}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error adding family member: {str(e)}")

# Private Router
# Get all family members
@user_private_router.get("/all-family-members", response_model=dict)
async def get_user_family_members_route(request: Request):
    try:
        user_id = request.state.uid
        
        family_members = await get_family_members(user_id)
        return {"success": True, "family_members": family_members}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family members: {str(e)}")
    
# Private Router
# Get all family members AND get your profile information.
@user_private_router.get("/all-people")
async def fetch_all_people(request: Request):
    return await process_fetch_all_people(request)

# Private Router
# Get specific family member
@user_private_router.get("/family-member/{family_member_id}", response_model=dict)
async def get_user_family_member_route(request: Request, family_member_id:str):
    try:
        user_id = request.state.uid
        
        member = await get_family_member_by_id(user_id, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        return {"success": True, "family_member": member}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family member: {str(e)}")

# Private Router
# Update family member
@user_private_router.patch("/family-member", response_model=dict)
async def update_user_family_member_route(request: Request, family_member_data: PersonUpdateRequest = Body(...)):
    try:
        user_id = request.state.uid
        success = await update_family_member(user_id, family_member_data.id, family_member_data)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        return {"success": True, "message": "Family member updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error updating family member: {str(e)}")

# Private Router
# Remove family member
@user_private_router.delete("/family-member/{family_id}", response_model=dict)
async def delete_user_family_member_route(request: Request, family_id:str):
    try:
        user_id = request.state.uid

        sweep = await unregister_family_member_across_upcoming(request, family_id)
        if not sweep.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Pre-delete cleanup failed: {sweep.get('msg')}")
        
        success = await delete_family_member(user_id, family_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        return {"success": success, "message": "Family member deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error deleting family member: {str(e)}")
    
# Private Router
# Update Language
@user_private_router.patch("/update-language", response_model=dict)
async def update_user_language(request: Request, data: dict = Body(...)):
    from mongo.churchuser import UserHandler

    try:
        uid = request.state.uid
        new_lang = data.get("language")

        if not new_lang or len(new_lang) not in (2, 3):
            raise HTTPException(status_code=400, detail="Invalid language code")

        result = await UserHandler.update_user({"uid": uid}, {"language": new_lang})
        if not result:
            raise HTTPException(status_code=400, detail="Failed to update language")

        return {"success": True, "language": new_lang}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating language: {str(e)}")

# Private Router
@user_private_router.get("/language", response_model=dict)
async def get_user_language(request: Request):
    try:
        language = request.state.user.get("language", "en")
        if not isinstance(language, str) or not language.strip():
            language = "en"
        return {"success": True, "language": language}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching language: {str(e)}")
    
    # Private Router
@user_private_router.get("/me/people", response_model=dict)
async def list_my_people_alias(request: Request):
    """
    Alias used by the web UI to fetch saved Event People.
    Returns the same payload as /users/all-family-members but under 'people'.
    """
    from helpers.MongoHelper import serialize_objectid
    try:
        user_id = request.state.uid
        family_members = await get_family_members(user_id)  # already implemented
        # Normalize shape to what the UI expects
        return {"success": True, "people": serialize_objectid(family_members)}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching people: {str(e)}")

# Private Router
@user_private_router.post("/me/people", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_person_alias(request: Request, family_member_data: PersonCreate = Body(...)):
    """
    Optional alias to create a new Event Person from the same screen.
    Mirrors POST /users/add-family-member but returns { success, person }.
    """
    from helpers.MongoHelper import serialize_objectid
    try:
        user_id = request.state.uid
        created_member = await add_family_member(user_id, family_member_data)
        if not created_member:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error adding person")
        return {"success": True, "person": serialize_objectid(created_member)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error adding person: {str(e)}")

# Private Router
@user_private_router.delete("/delete-account", response_model=dict)
async def delete_account_route(request: Request):
    """Delete user account from both MongoDB and Firebase"""
    try:
        uid = request.state.uid

        # Check if target user has Administrator role - admins cannot be deleted
        is_admin = await check_if_user_is_admin(uid)
        if is_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrator accounts cannot be deleted. To delete an admin account, first remove their administrator privileges."
            )

        sweep = await unregister_user_across_upcoming(request, target_uid=uid, admin_initiated=False)
        if not sweep.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Pre-delete cleanup failed: {sweep.get('msg')}")
        
        result = await delete_user_account(uid)
        
        if not result["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting account: {str(e)}")

# Mod Router - Admin can delete any user account (with safeguards)
@user_mod_router.delete("/delete-user/{target_uid}", response_model=dict)
async def delete_user_by_admin_route(request: Request, target_uid: str):
    """Delete any user account (admin only) - with safeguard against deleting admin accounts"""
    try:
        # Check if target user has Administrator role - admins cannot be deleted via admin panel
        is_admin = await check_if_user_is_admin(target_uid)
        if is_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrator accounts cannot be deleted. To delete an admin account, first remove their administrator privileges."
            )
        
        sweep = await unregister_user_across_upcoming(request, target_uid=target_uid, admin_initiated=True)
        if not sweep.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Pre-delete cleanup failed: {sweep.get('msg')}")
        
        result = await delete_user_account(target_uid)
        
        if not result["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting user: {str(e)}")
