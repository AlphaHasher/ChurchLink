from database import DB
from datetime import datetime
from roles import RoleHandler

class UserHandler:
    @staticmethod
    async def create_schema(first_name, last_name, email, roles, phone=None, birthday=None, address=None):
        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "roles": await RoleHandler.map(roles),
            "phone": phone,
            "birthday": birthday,
            "address": address or {
                "address": None,
                "suite": None,
                "city": None,
                "state": None,
                "country": None,
                "postal_code": None
            },

            "bible_notes": [],
            "createdOn": datetime.now(),
        }

    @staticmethod
    async def is_user(email):
        return len(await DB.find_documents("users", {"email": email})) > 0

    ################
    ## Operations ##
    ################

    @staticmethod
    async def create_user(first_name, last_name, email, roles, phone=None, birthday=None, address=None):
        """
        'roles' is a list of role names
        """
        if await UserHandler.is_user(email):
            print(f"User with this email already exists: {email}")
            return

        try:
            await DB.insert_document("users", await UserHandler.create_schema(
                first_name,
                last_name,
                email,
                roles,
                phone,
                birthday,
                address
            ))
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    async def update_name(email, first_name=None, last_name=None):
        if not await UserHandler.is_user(email):
            print(f"User with this email does not exist: {email}")
            return

        try:
            await DB.update_document("users", {"email": email}, {
                    "first_name": first_name,
                    "last_name": last_name
            })
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    async def update_roles(email, roles):
        if not await UserHandler.is_user(email):
            print(f"User with this email does not exist: {email}")
            return

        try:
            await DB.update_document("users", {"email": email}, {
                    "roles": await RoleHandler.map(roles)
            })
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    async def delete_user(email):
        try:
            await DB.delete_documents("users", {"email": email})
        except Exception as e:
            print(f"An error occurred:\n {e}")