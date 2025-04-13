from mongo.firebase_sync import FirebaseSyncer
from mongo.churchuser import UserHandler


async def process_sync_by_uid(uid):
    syncRequest = await FirebaseSyncer.syncUserByUID(uid)
    if syncRequest:
        return { "verified": True }
    else:
        return {'verified': False}
    
async def fetch_users():
    raw_users = await UserHandler.find_all_users()
    users = [
        {   
            "uid": u.get("uid"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "email": u.get("email"),
            "roles": u.get("roles", [])
        }
        for u in raw_users
    ]
    return {"users": users}