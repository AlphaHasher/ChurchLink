from mongo.roles import RoleHandler
from pydantic import BaseModel, Field, create_model
from mongo.churchuser import UserHandler
from fastapi import Request

permission_template = RoleHandler.permission_template

PermissionsMixin = create_model(
    "PermissionsMixin",
    **{k: (bool, Field(default=v)) for k, v in permission_template.items()},
)

class RoleCreateInput(PermissionsMixin):
    name: str = Field(..., min_length=1, max_length=100, description="Role name")

class RoleUpdateInput(PermissionsMixin):
    id: str = Field(alias="_id", min_length=1, description="Role ID")
    name: str = Field(..., min_length=1, max_length=100, description="Role name")

class UserRoleUpdateInput(BaseModel):
    uid: str = Field(..., min_length=1, description="User ID")
    role_ids: list[str] = Field(..., description="List of role IDs")

async def fetch_perms():
    try:
        perms = await RoleHandler.find_all_roles()

        for role in perms:
            if "_id" in role:
                role["_id"] = str(role["_id"])

        return {"Success": True, "permissions": perms}
    except Exception as e:
        return {"Success": False, "msg": f"Failed to fetch permissions: {str(e)}", "permissions": []}

async def create_role(payload: RoleCreateInput, request: Request):
    user = request.state.user
    user_perms = request.state.perms

    # Return failure if no user found
    if user is None:
        return {"success": False, "msg":"User not found!"}
    
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
    for key, value in permission_template.items():
        if getattr(payload, key):
            permStr.append(key)
    if payload.name.strip() == '':
        return {"success": False, "msg":"Your role could not be created. You have provided an invalid name."}
    try:
        if await RoleHandler.create_role(payload.name, permStr):
            return {"success": True, "msg":"Your role has been created."}
        else:
            return {"success": False, "msg":"Your role could not be created. Did you try to use a duplicate role name?"}
    except Exception as e:
        return {"success": False, "msg": f"Your role could not be created due to an error: {str(e)}"}
    
async def update_role(payload: RoleUpdateInput, request:Request):
    user = request.state.user
    user_perms = request.state.perms

    # Find role in mongo
    role = await RoleHandler.find_role_by_id(payload.id)
    # Return failure if no user found
    if user is None:
        return {"success": False, "msg":"User not found!"}
    # Return failure if no role found
    if role is None:
        return {"success": False, "msg":"Role not found!"}
    # If user is not an Admin or Permissions manager, refuse
    if not user_perms['admin'] and not user_perms['permissions_management']:
        return {"success":False, "msg":"You do not have the necessary permissions to edit roles!"}
    # If perm has permissions_management and editor not an admin, refuse
    if not user_perms['admin'] and payload.permissions_management:
        return {"success":False, "msg":"Only Administrators may edit roles granting permissions management!"}
    
    # Check if this role currently has admin permissions and the update would remove them
    current_admin_perm = role.get('permissions', {}).get('admin', False)
    new_admin_perm = getattr(payload, 'admin', False)
    
    if current_admin_perm and not new_admin_perm:
        # Role is losing admin permissions, check if this affects any users
        users_with_this_role = await UserHandler.find_users_with_role_id(payload.id)
        
        admin_count = await count_admin_users()
        admins_losing = []
        current_user_losing_admin = False
        
        for user_with_role in users_with_this_role:
            # Simulate what permissions would be after the role update
            current_role_ids = user_with_role.get('roles', [])
            # We need to check what permissions they'd have with the updated role
            updated_role_permissions = {}
            for key in RoleHandler.permission_template:
                updated_role_permissions[key] = getattr(payload, key, False)
            
            # Check if user would lose admin permissions
            # Manually override the admin permission for this role
            if str(payload.id) in [str(rid) for rid in current_role_ids]:
                # This user has the role being updated, check if they'd lose admin
                other_roles_admin = False
                for rid in current_role_ids:
                    if str(rid) != payload.id:
                        other_role = await RoleHandler.find_role_by_id(str(rid))
                        if other_role and other_role.get('permissions', {}).get('admin', False):
                            other_roles_admin = True
                            break
                
                if not other_roles_admin:
                    # This user would lose admin permissions
                    admins_losing.append(user_with_role)
                    # Track if current user is losing admin permissions
                    if user['uid'] == user_with_role['uid']:
                        current_user_losing_admin = True
        
        # Check if removing admin from this role would drain admin coverage to zero
        if admins_losing and admin_count - len(admins_losing) <= 0:
            losing_names = ", ".join(
                (f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get('uid', ''))
                for u in admins_losing
            )
            return {"success": False, "msg": f"You cannot remove admin permissions from this role because it would remove admin permissions from every remaining administrator ({losing_names})."}
        
        # Check for special case where current user is losing their own admin permissions
        if current_user_losing_admin:
            return {"success": False, "msg": "You cannot remove admin permissions from this role because it would remove your own admin permissions."}

    #Verify no illegal perms are attempted to be modified
    for key, value in user_perms.items():
        # Strictly refuse if role has Admin or Permissions Management
        if key in ['admin', 'permissions_management']:
            if getattr(payload, key) and not user_perms['admin']:
                return {"success":False, "msg":f"You do not have the necessary permissions to edit a role with permission: {key}!"}
        else:
            existing_value = role['permissions'].get(key, False)
            if (getattr(payload, key) != existing_value) and not value:
                return {"success":False, "msg":f"You do not have the necessary permissions to enable or disable the permission: {key}!"}
                
    permStr = []
    for key, value in permission_template.items():
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
        return {"success": False, "msg": f"Your role could not be updated due to an error: {str(e)}"}
    
async def delete_role(payload: RoleUpdateInput, request:Request):
    user = request.state.user
    user_perms = request.state.perms

    # Return failure if no user found
    if user is None:
        return {"success": False, "msg":"User not found!"}
    # If user is not an Admin or Permissions manager, refuse
    if not user_perms['admin'] and not user_perms['permissions_management']:
        return {"success":False, "msg":"You do not have the necessary permissions to delete roles!"}
    
    # Find the role to be deleted
    role_to_delete = await RoleHandler.find_role_by_id(payload.id)
    if not role_to_delete:
        return {"success": False, "msg":"Role not found!"}
    
    # Check if this role has admin permissions
    if role_to_delete.get('permissions', {}).get('admin', False):
        # Check if deleting this role would leave any admins without admin permissions
        users_with_this_role = await UserHandler.find_users_with_role_id(payload.id)
        
        admin_count = await count_admin_users()
        admins_losing = []
        current_user_losing_admin = False
        
        for user_with_role in users_with_this_role:
            # Check if this user would lose admin permissions
            current_role_ids = user_with_role.get('roles', [])
            new_role_ids = [rid for rid in current_role_ids if str(rid) != payload.id]
            
            would_lose_admin = await user_would_lose_admin_permissions(user_with_role['uid'], [str(rid) for rid in new_role_ids])
            if would_lose_admin:
                admins_losing.append(user_with_role)
                # Track if current user is losing admin permissions
                if user['uid'] == user_with_role['uid']:
                    current_user_losing_admin = True
        
        # Check if removing this role would drain admin coverage to zero
        if admins_losing and admin_count - len(admins_losing) <= 0:
            losing_names = ", ".join(
                (f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get('uid', ''))
                for u in admins_losing
            )
            return {"success": False, "msg": f"You cannot delete this admin role because it would remove admin permissions from every remaining administrator ({losing_names})."}
        
        # Check for special case where current user is losing their own admin permissions
        if current_user_losing_admin:
            return {"success": False, "msg": "You cannot delete this admin role because it would remove your own admin permissions."}

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
            return {"success": False, "msg":"Role could not be deleted. The role may not exist or be in use."}
    except Exception as e:
        return {"success": False, "msg": f"Your role could not be deleted due to an error: {str(e)}"}
    
async def update_users_with_role(id: str):
    try:
        users_with_role = await UserHandler.find_users_with_role_id(id)
        for user in users_with_role:
            await UserHandler.update_roles(user['uid'], user['roles'])
    except Exception as e:
        print(f"Error updating users with role {id}: {str(e)}")
    
async def strip_users_of_role(id: str):
    try:
        users_with_role = await UserHandler.find_users_with_role_id(id)
        for user in users_with_role:
            updated_roles = [rid for rid in user.get("roles", []) if rid != id]
            await UserHandler.update_roles(user['uid'], updated_roles)
    except Exception as e:
        print(f"Error stripping users of role {id}: {str(e)}")
        raise  # Re-raise so calling function knows there was an error

async def count_admin_users():
    """
    Count the total number of users with admin permissions.
    Returns the count of users who have roles with admin permissions.
    """
    try:
        admin_roles = await RoleHandler.find_roles_with_permissions(['admin'])
        if not admin_roles:
            return 0
        
        admin_users = await UserHandler.find_users_with_permissions(['admin'])
        return len(admin_users)
    except Exception as e:
        print(f"Error counting admin users: {str(e)}")
        return 0

async def user_would_lose_admin_permissions(uid: str, new_role_ids: list[str]):
    """
    Check if updating a user's roles would result in them losing admin permissions.
    Returns True if they would lose admin permissions, False otherwise.
    """
    try:
        # Get current user
        current_user = await UserHandler.find_by_uid(uid)
        if not current_user:
            return False
        
        # Check if user currently has admin permissions
        current_perms = await RoleHandler.infer_permissions(current_user.get('roles', []))
        if not current_perms.get('admin', False):
            return False  # User doesn't currently have admin permissions
        
        # Check if new roles would still grant admin permissions
        new_perms = await RoleHandler.infer_permissions(new_role_ids)
        return not new_perms.get('admin', False)  # True if they would lose admin permissions
    except Exception as e:
        print(f"Error checking if user would lose admin permissions: {str(e)}")
        return False

async def update_user_roles(payload: UserRoleUpdateInput, request:Request):
    user = request.state.user
    user_perms = request.state.perms

    # Return failure if no user found
    if user is None:
        return {"success": False, "msg":"User not found!"}
    # If user is not an Admin or Permissions manager, refuse
    if not user_perms['admin'] and not user_perms['permissions_management']:
        return {"success":False, "msg":"You do not have the necessary permissions to assign roles!"}

    # Validate payload
    if not payload.uid or not payload.uid.strip():
        return {"success": False, "msg": "Invalid user ID provided"}
    
    if payload.role_ids is None:
        return {"success": False, "msg": "Role IDs list cannot be null"}

    # Check if the target user would lose admin permissions
    would_lose_admin = await user_would_lose_admin_permissions(payload.uid, payload.role_ids)
    if would_lose_admin:
        admin_count = await count_admin_users()
        if payload.uid == user['uid']:
            # User is modifying their own admin permissions
            if admin_count <= 1:
                return {"success": False, "msg": "You cannot remove your own admin permissions because you are the only administrator. Please assign admin permissions to another user first."}
            return {"success": False, "msg": "You cannot remove your own admin permissions. Please have another administrator modify your roles if needed."}
        else:
            # User is modifying another user's admin permissions
            if admin_count <= 1:
                return {"success": False, "msg": "You cannot remove admin permissions because this is the last administrator in the system."}

    try:
        roles = await RoleHandler.get_user_assignable_roles(user_perms)
        if not roles:
            return {"success": False, "msg": "No assignable roles found for your permission level"}
            
        valid_ids = []
        for role in roles:
            valid_ids.append(str(role['_id']))
        
        # Validate each role ID
        for role_id in payload.role_ids:
            if not role_id or not role_id.strip():
                return {"success": False, "msg": "Invalid role ID in the list"}
            if role_id not in valid_ids:
                return {"success": False, "msg": f"You do not have the necessary permissions to assign role with ID: {role_id}"}
    except Exception as e:
        return {"success": False, "msg": f"Error validating roles: {str(e)}"}
    try:
        result = await UserHandler.update_roles(payload.uid, payload.role_ids)
        if result:
            return {"success": True, "msg":"Your user roles have been updated successfully."}
        else:
            return {"success": False, "msg":"User not found or role update failed. Please verify the user exists."}
    except Exception as e:
        return {"success": False, "msg": f"Your user roles could not be updated due to an error: {str(e)}"}


