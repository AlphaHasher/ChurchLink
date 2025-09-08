from mongo.firebase_sync import FirebaseSyncer
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from pydantic import BaseModel, Field
from fastapi import Request


class MyPermsRequest(BaseModel):
    user_assignable_roles: bool
    event_editor_roles: bool
    user_role_ids: bool

async def process_sync_by_uid(request:Request):
    uid = request.state.uid
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
    return {"success": True, "users": users}
    
async def get_my_permissions(payload: MyPermsRequest, request:Request):
    user = request.state.user
    perms = request.state.perms

    retDict = {"success":True, "perms":perms, "msg":"", "user_assignable_roles":[], "event_editor_roles":[], "user_role_ids":[]}

    if payload.user_assignable_roles:
        raw_roles = await RoleHandler.get_user_assignable_roles(perms)
        roles = [
            {"_id" :str(r.get("_id")),
                "name": r.get("name"),
                "permissions": r.get("permissions", {})
            }
            for r in raw_roles
        ]
        retDict['user_assignable_roles'] = roles
        
    if payload.event_editor_roles:
        raw_roles = await RoleHandler.get_user_event_editor_roles(user['roles'], perms)
        roles = [
            {"_id" :str(r.get("_id")),
                "name": r.get("name"),
                "permissions": r.get("permissions", {})
            }
            for r in raw_roles
        ]
        retDict['event_editor_roles'] = roles
    if payload.user_role_ids:
        retDict['user_role_ids'] = user['roles']
    
    return retDict