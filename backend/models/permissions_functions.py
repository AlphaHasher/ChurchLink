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
    # Find user in mongo
    user = await UserHandler.find_by_uid(uid)
    # Return failure if no user found
    if user is None:
        return {"success": False, "msg":"User not found!"}
    # Gather user permissions
    user_perms = await RoleHandler.infer_permissions(user['roles'])
    # If user is not an Admin or Permissions manager, refuse
    if not user_perms['admin'] and not user_perms['permissions_management']:
        return {"success":False, "msg":"You do not have the necessary permissions to create roles!"}
    #Verify no illegal perms are added
    for key, value in user_perms.items():
        if key in ['admin', 'permissions_management']:
            if getattr(payload, key) and not user_perms['admin']:
                return {"success":False, "msg":f"You do not have the necessary permissions to create a role with permission: {key}!"}
        else:
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
    
async def update_role(payload: RoleUpdateInput, uid: str):
    # Find user in mongo
    user = await UserHandler.find_by_uid(uid)
    # Find role in mongo
    role = await RoleHandler.find_role_by_id(payload.id)
    # Return failure if no user found
    if user is None:
        return {"success": False, "msg":"User not found!"}
    # Return failure if no role found
    if role is None:
        return {"success": False, "msg":"Role not found!"}
    # Gather user permissions
    user_perms = await RoleHandler.infer_permissions(user['roles'])
    # If user is not an Admin or Permissions manager, refuse
    if not user_perms['admin'] and not user_perms['permissions_management']:
        return {"success":False, "msg":"You do not have the necessary permissions to edit roles!"}
    # If perm has permissions_management and editor not an admin, refuse
    if not user_perms['admin'] and payload.permissions_management:
        return {"success":False, "msg":"Only Administrators may edit roles granting permissions management!"}
    #Verify no illegal perms are attempted to be modified
    for key, value in user_perms.items():
        # Strictly refuse if role has Admin or Permissions Management
        if key in ['admin', 'permissions_management']:
            if getattr(payload, key) and not user_perms['admin']:
                return {"success":False, "msg":f"You do not have the necessary permissions to edit a role with permission: {key}!"}
        else:
            if (getattr(payload, key)!= role['permissions'][key]) and not value:
                return {"success":False, "msg":f"You do not have the necessary permissions to enable or disable the permission: {key}!"}
                
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
    
async def delete_role(payload: RoleUpdateInput, uid:str):
    # Find user in mongo
    user = await UserHandler.find_by_uid(uid)
    # Return failure if no user found
    if user is None:
        return {"success": False, "msg":"User not found!"}
    # Gather user permissions
    user_perms = await RoleHandler.infer_permissions(user['roles'])
    # If user is not an Admin or Permissions manager, refuse
    if not user_perms['admin'] and not user_perms['permissions_management']:
        return {"success":False, "msg":"You do not have the necessary permissions to delete roles!"}
    #Verify no illegal perms are present
    for key, value in user_perms.items():
        if key in ['admin', 'permissions_management']:
            if getattr(payload, key) and not user_perms['admin']:
                return {"success":False, "msg":f"You do not have the necessary permissions to delete a role with permission: {key}!"}
        else:
            if getattr(payload, key) and not value:
                return {"success":False, "msg":f"You do not have the necessary permissions to delete a role with permission: {key}!"}
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


