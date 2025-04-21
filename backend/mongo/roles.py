from mongo.database import DB
from bson import ObjectId

class RoleHandler:
    permission_template = {
        "admin": False,
        "finance": False,
        "website_management": False,
        "event_management": False,
        "page_management": False,
        "media_management":False,
    }

    @staticmethod
    async def verify_admin_role():
        roleCheck = await RoleHandler.find_role("Administrator")
        if roleCheck and len(roleCheck) == 1:
            return
        else:
            perms = RoleHandler.permission_template.copy()
            for key, value in perms.items():
                perms[key] = True
            await RoleHandler.create_role("Administrator", perms)

    @staticmethod
    async def infer_permissions(role_ids):
        permissions = RoleHandler.permission_template.copy()

        for id in role_ids:
            role = await RoleHandler.find_role_by_id(id)
            if role == None:
                return permissions
            for key, value in role['permissions'].items():
                if key == '_id':
                    continue
                permissions[key] = permissions[key] or value

        return permissions



    @staticmethod
    def create_permission_list(perm_strs):
        perms = RoleHandler.permission_template.copy()
        for perm in perm_strs:
            perms[perm] = True
        return perms

    @staticmethod
    async def is_role(name):
        return len(await DB.find_documents("roles", {"name": name})) > 0

    @staticmethod
    async def names_to_ids(roles_strs):
        role_ids = []
        for role in roles_strs:
            if await RoleHandler.is_role(role):
                role_ids.append((await RoleHandler.find_role(role))[0]["_id"])
        return role_ids

    ################
    ## Operations ##
    ################
    @classmethod
    def create_schema(cls, name, perm_strs):
        return {
            "name": name,
            "permissions": RoleHandler.create_permission_list(perm_strs)
        }
    
    @staticmethod
    async def create_role(name, permissions):
        """
        'permissions' is a list of string key names for all selected permissions
        """
        if await RoleHandler.is_role(name):
            print(f"RoleHandler with this name already exists: {name}")
            return False

        try:
            await DB.insert_document("roles", RoleHandler.create_schema(
                name,
                permissions
            ))
            return True
        except Exception as e:
            print(f"An error occurred:\n {e}")
            return False

    @staticmethod
    async def find_all_roles():
        return await DB.find_documents("roles", {})

    @staticmethod
    async def find_role(name):
        return await DB.find_documents("roles", {"name": name})

    @staticmethod
    async def find_role_id(name):
        result = await DB.find_documents("roles", {"name": name})
        if result and len(result) > 0:

            return result[0]["_id"]
        return None
    
    @staticmethod
    async def find_role_by_id(id):
        _id = ObjectId(id)
        result = await DB.find_documents("roles", {"_id":_id})
        if result and len(result) > 0:
            return result[0]
        return None

    @staticmethod
    async def find_roles_with_permissions(permission_names):
        query = {}
        for perm in permission_names:
            query[f"permissions.{perm}"] = True

        return await DB.find_documents("roles", query)

    @staticmethod
    async def update_role(id, name, permissions):

        _id = ObjectId(id)

        # Check to see if requested name already exists
        if await RoleHandler.is_role(name):
            # It is okay if the requested name exists and it's the ID requesting to be updated
            # It means the perms are being updated, without the name being updated.
            # Only send error if the ID of the existing document doesnt match the parameter ID
            check = await RoleHandler.find_role_id(name)
            if check != _id:
                print(f"RoleHandler with this name already exists: {name}")
                return False

        try:
            await DB.update_document("roles", {"_id": _id}, RoleHandler.create_schema(
                name,
                permissions
            ))
            return True
        except Exception as e:
            print(f"An error occurred:\n {e}")
            return False

    @staticmethod
    async def delete_role(id):
        try:
            _id = ObjectId(id)
            await DB.delete_documents("roles", {"_id": _id})
            return True
        except Exception as e:
            print(f"An error occurred:\n {e}")
            return False