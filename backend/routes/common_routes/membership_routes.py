from typing import Literal
from fastapi import APIRouter, Request, Body, Query

from models.membership_request import (
    create_or_update_membership_request,
    update_membership_request_admin,
    get_membership_request_by_uid as get_mr_by_uid,
    search_membership_requests as search_mr,
    MembershipRequestIn,
    MembershipRequestAdminUpdate,
    MRSearchParams,
)

from controllers.users_functions import change_user_member_status

member_private_router = APIRouter(prefix="/membership", tags=["Membership"])
member_mod_router = APIRouter(prefix="/membership", tags=["Membership"])

# Private Route
@member_private_router.post("/create-request")
async def create_membership_request(request: Request, member_in: MembershipRequestIn = Body(...)):
    uid = request.state.uid
    if request.state.user.get("membership"):
        return {"success": False, "msg": "You are already a member, and therefore cannot create a request to become one!"}
    return await create_or_update_membership_request(uid, member_in)

# Mod Route
@member_mod_router.patch("/respond-to-request")
async def respond_to_membership_request(update: MembershipRequestAdminUpdate = Body(...)):
    await change_user_member_status(update.uid, update.approved)
    return await update_membership_request_admin(update)

# Mod Route
@member_mod_router.get("/get-request/{uid}")
async def get_membership_request(uid: str):
    return await get_mr_by_uid(uid)

# Mod Route
@member_mod_router.get("/search-requests")
async def search_membership_requests_route(
    page: int = Query(0, ge=0),
    pageSize: int = Query(25, ge=1, le=200),
    searchField: Literal["email", "name", "message"] = Query("name"),
    searchTerm: str = Query("", description="Case-insensitive contains"),
    sortBy: Literal["created_on", "resolved", "approved"] = Query("created_on"),
    sortDir: Literal["asc", "desc"] = Query("asc"),
    status: Literal["pending", "approved", "rejected"] = Query("pending"),
):
    params = MRSearchParams(
        page=page,
        pageSize=pageSize,
        searchField=searchField,
        searchTerm=searchTerm,
        sortBy=sortBy,
        sortDir=sortDir,
        status=status,  # NEW
    )
    return await search_mr(params)
