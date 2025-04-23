from mongo.roles import RoleHandler
from pydantic import BaseModel, Field
from mongo.roles import RoleHandler
from mongo.churchuser import UserHandler
from helpers.StrapiHelper import StrapiHelper


class RoleCreateInput(BaseModel):
    name: str
    admin: bool
    permissions_management: bool
    event_editing: bool
    event_management: bool
    media_management: bool

class RoleUpdateInput(BaseModel):
    id: str = Field(alias="_id")
    name: str
    admin: bool
    permissions_management: bool
    event_editing: bool
    event_management: bool
    media_management: bool

class UserRoleUpdateInput(BaseModel):
    uid: str
    role_ids: list

boolKeys = ['admin', 'permissions_management', 'event_editing', 'event_management', 'media_management']

async def fetch_perms(uid):
    if await UserHandler.does_user_have_permissions(uid):
        perms = await RoleHandler.find_all_roles()

        for role in perms:
            if "_id" in role:
                role["_id"] = str(role["_id"])

        return {"Success":True, "permissions": perms}
    else:
        return {"success":False, "permissions":[]}

async def create_role(payload: RoleCreateInput, uid: str):
    user = await UserHandler.find_by_uid(uid)
    if user is None:
        return {"success": False, "msg":"User not found!"}
    user_perms = await RoleHandler.infer_permissions(user['roles'])
    if not user_perms['admin'] and not user_perms['permissions_management']:
        return {"success":False, "msg":"You do not have the necessary permissions to create roles!"}
    for key, value in user_perms.items():
        if getattr(payload, key) and not value:
            return {"success":False, "msg":f"You do not have the necessary permissions to create a role with permission: {key}!"}

    permStr = []
    for key in boolKeys:
        if getattr(payload, key):
            permStr.append(key)
    if payload.name.strip() == '':
        return {"success": False, "msg":"Your role could not be created. You have provided an invalid name."}
    try:
        if await RoleHandler.create_role(payload.name, permStr):
            return {"success": True, "msg":"Your role has been created."}
        else:
            return {"success": False, "msg":"Your role could not be created. Did you try to use a duplicate role name?"}
    except:
        return {"success": False, "msg":"Your role could not be created due to an unknown critical error!"}
    
async def update_role(payload: RoleUpdateInput):
    permStr = []
    for key in boolKeys:
        if getattr(payload, key):
            permStr.append(key)
    try:
        if await RoleHandler.update_role(payload.id, payload.name, permStr):
            await update_users_with_role(payload.id)
            return {"success": True, "msg":"Your role has been updated."}
        else:
            return {"success": False, "msg":"Your role could not be updated. Did you try to use a duplicate role name?"}
    except Exception as e:
        print(e)
        return {"success": False, "msg":"Your role could not be updated due to an unknown critical error!"}
    
async def delete_role(payload: RoleUpdateInput):
    try:
        await strip_users_of_role(payload.id)
        if await RoleHandler.delete_role(payload.id):
            return {"success": True, "msg":"Your role has been deleted successfully."}
        else:
            return {"success": False, "msg":"Your role could not be deleted due to an unknown critical error!"}
    except:
        return {"success": False, "msg":"Your role could not be deleted due to an unknown critical error!"}
    
async def update_users_with_role(id:str):
    users_with_role = await UserHandler.find_users_with_role_id(id)
    for user in users_with_role:
        await UserHandler.update_roles(user['uid'], user['roles'], StrapiHelper.sync_strapi_roles)
    
async def strip_users_of_role(id: str):
    users_with_role = await UserHandler.find_users_with_role_id(id)
    for user in users_with_role:
        updated_roles = [rid for rid in user.get("roles", []) if rid != id]
        await UserHandler.update_roles(user['uid'], updated_roles, StrapiHelper.sync_strapi_roles)

async def update_user_roles(payload: UserRoleUpdateInput):
    try:
        if await UserHandler.update_roles(payload.uid, payload.role_ids, StrapiHelper.sync_strapi_roles):
            return {"success": True, "msg":"Your user roles have been updated successfully."}
        else:
            return {"success": False, "msg":"Your user roles could not be updated due to an unknown critical error!"}
    except:
        return {"success": False, "msg":"Your user roles could not be updated due to an unknown critical error!"}


