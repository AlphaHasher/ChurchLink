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

    @classmethod
    def create_schema(cls, name, perm_strs):
        return {
            "name": name,
            "permissions": RoleHandler.create_permission_list(perm_strs)
        }

    @staticmethod
    async def is_role(name):
        return len(await DB.find_documents("roles", {"name": name})) > 0

    ################
    ## Operations ##
    ################
    
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
    async def get_role(name):
        return await DB.find_documents("roles", {"name": name})

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

    @staticmethod
    async def names_to_ids(roles_strs):
        role_ids = []
        for role in roles_strs:
            if await RoleHandler.is_role(role):
                role_ids.append((await RoleHandler.get_role(role))[0]["_id"])
        return role_ids