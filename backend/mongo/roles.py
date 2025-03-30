from database import DB

class RoleHandler:
    permission_template = {
        "admin": False,
        "finance": False,
        "website_management": False,
        "event_management": False,
        "page_management": False,
    }

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
            return

        try:
            await DB.insert_document("roles", RoleHandler.create_schema(
                name,
                permissions
            ))
        except Exception as e:
            print(f"An error occurred:\n {e}")

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
    async def find_roles_with_permissions(permission_names):
        query = {}
        for perm in permission_names:
            query[f"permissions.{perm}"] = True

        return await DB.find_documents("roles", query)

    @staticmethod
    async def update_role(name, permissions):
        if not await RoleHandler.is_role(name):
            print(f"RoleHandler with this name does not exist: {name}")

        try:
            await DB.update_document("roles", {"name": name}, RoleHandler.create_schema(
                name,
                permissions
            ))
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    async def delete_role(name):
        try:
            await DB.delete_documents("roles", {"name": name})
        except Exception as e:
            print(f"An error occurred:\n {e}")