from fastapi import APIRouter, Query, Depends
from models.users_functions import process_sync_by_uid, fetch_users
from helpers.Firebase_helpers import authenticate_uid

users_router = APIRouter()

###################
# Update Request

@users_router.post("/sync-user")
async def process_sync_request(uid: str = Depends(authenticate_uid)):
    return await process_sync_by_uid(uid)

@users_router.get("/get-users")
async def process_get_users(uid: str = Depends(authenticate_uid)):
    return await fetch_users(uid)

