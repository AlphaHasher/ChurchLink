from mongo.firebase_sync import FirebaseSyncer
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler


async def process_sync_by_uid(uid):
    syncRequest = await FirebaseSyncer.syncUserByUID(uid)
    if syncRequest:
        return { "verified": True }
    else:
        return {'verified': False}
    
async def fetch_users(uid):
    if await UserHandler.does_user_have_permissions(uid):

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
    else:
        return {"success": False, "users": []}
    
async def get_my_permissions(uid):
    if await UserHandler.does_user_have_permissions(uid):
        user = await UserHandler.find_by_uid(uid)
        if user is not None:
            perms = await RoleHandler.infer_permissions(user['roles'])
            return {"success":True, "perms":perms, "msg": "Permissions successfully fetched!"}
        else:
            return {"success":False, "perms":RoleHandler.permission_template.copy(), "msg": "Mongo user not found!"}
    else:
        return {"success":False, "perms": RoleHandler.permission_template.copy(), "msg": "User does not have permissions!"}