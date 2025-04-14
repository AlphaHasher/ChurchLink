from mongo.roles import RoleHandler
from pydantic import BaseModel, Field
from mongo.roles import RoleHandler
from mongo.churchuser import UserHandler
from helpers.StrapiHelper import StrapiHelper


class RoleCreateInput(BaseModel):
    name: str
    admin: bool
    finance: bool
    website_management: bool
    event_management: bool
    page_management: bool
    media_management: bool

class RoleUpdateInput(BaseModel):
    id: str = Field(alias="_id")
    name: str
    admin: bool
    finance: bool
    website_management: bool
    event_management: bool
    page_management: bool
    media_management: bool

class UserRoleUpdateInput(BaseModel):
    uid: str
    role_ids: list

boolKeys = ['admin', 'finance', 'website_management', 'event_management', 'page_management', 'media_management']

async def fetch_perms(uid):
    if await UserHandler.does_user_have_permissions(uid):
        perms = await RoleHandler.find_all_roles()

        for role in perms:
            if "_id" in role:
                role["_id"] = str(role["_id"])

        return {"Success":True, "permissions": perms}
    else:
        return {"success":False, "permissions":[]}

async def create_role(payload: RoleCreateInput):
    permStr = []
    for key in boolKeys:
        if getattr(payload, key):
            permStr.append(key)
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


