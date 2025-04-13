from fastapi import APIRouter, Query
from models.users_functions import process_sync_by_uid, fetch_users

users_router = APIRouter()

###################
# Update Request

# TODO: This probably needs proper middleware too
@users_router.post("/sync-user")
async def process_sync_request(uid: str = Query(..., description="UID requested to be synced")):
    return await process_sync_by_uid(uid)

# TODO: this DEFINITELY needs middleware
@users_router.get("/get-users")
async def process_get_users():
    return await fetch_users()

