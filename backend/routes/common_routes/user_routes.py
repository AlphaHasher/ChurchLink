from typing import Literal
from fastapi import APIRouter, HTTPException, status, Query, Body, Request

# Import models and functions from models/user.py
from models.user import ( PersonCreate, PersonUpdateRequest,
    add_family_member, get_family_members, get_family_member_by_id, update_family_member, delete_family_member
)
from controllers.users_functions import fetch_users, process_sync_by_uid, get_my_permissions, fetch_profile_info, update_profile, get_is_init, update_contact, search_users_paged, UsersSearchParams, search_logical_users_paged, MyPermsRequest, PersonalInfo, ContactInfo

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
    return await update_profile(request, profile_data)

# Private Route
@user_private_router.patch("/update-contact")
async def process_update_contact(request:Request, contact_info: ContactInfo = Body(...)):
    return await update_contact(request, contact_info)

# Private Router
@user_private_router.get("/is-init")
async def process_is_init(request: Request):
    return await get_is_init(request)

# Mod Router
@user_mod_router.get("/check-mod")
async def process_check_mod(request:Request):
    if type(request.state.roles) == list and len(request.state.roles) > 0:
        return {'success':True}
    else:
        return {'success':False}

# Mod Router
@user_mod_router.get("/get-users")
async def process_get_users(request:Request):
    return await fetch_users()

# Mod Router
# Intelligent searching for users table.
@user_mod_router.get("/search-users")
async def process_search_users(
    request: Request,
    page: int = Query(0, ge=0),
    pageSize: int = Query(25, ge=1, le=200),
    searchField: Literal["email", "name"] = Query("email"),
    searchTerm: str = Query("", description="Case-insensitive contains"),
    sortBy: Literal["email", "name", "createdOn", "uid"] = Query("createdOn"),
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
    sortBy: Literal["email", "name", "createdOn", "uid"] = Query("name"),
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
        
        success = await delete_family_member(user_id, family_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        return {"success": success, "message": "Family member deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error deleting family member: {str(e)}")
    
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