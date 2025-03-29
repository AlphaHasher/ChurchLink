from bson import ObjectId

from database import DB
from datetime import datetime
from roles import RoleHandler

class UserHandler:
    @staticmethod
    async def is_user(email):
        return len(await DB.find_documents("users", {"email": email})) > 0

    ################
    ## Operations ##
    ################
    @staticmethod
    async def create_schema(first_name, last_name, email, roles, phone=None, birthday=None, address=None):
        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "roles": await RoleHandler.names_to_ids(roles),
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
    async def find_users_with_role_id(role_id):
        return await DB.find_documents("users", {"roles": [ObjectId(role_id)]})

    @staticmethod
    async def find_users_with_permissions(permission_names):
        roles_with_permissions = await RoleHandler.find_roles_with_permissions(permission_names)
        role_ids = [role["_id"] for role in roles_with_permissions]
        return await DB.find_documents("users", {"roles": {"$in": role_ids}}) if role_ids else []

    @staticmethod
    async def find_by_first_name(first_name):
        return await DB.find_documents("users", {"first_name": first_name})

    @staticmethod
    async def find_by_last_name(last_name):
        return await DB.find_documents("users", {"last_name": last_name})

    @staticmethod
    async def find_by_full_name(first_name, last_name):
        return await DB.find_documents("users", {
            "first_name": first_name,
            "last_name": last_name
        })

    @staticmethod
    async def find_by_email(email):
        return await DB.find_documents("users", {"email": email})

    @staticmethod
    async def find_by_phone(phone):
        return await DB.find_documents("users", {"phone": phone})

    @staticmethod
    async def find_by_age(age):
        today = datetime.now()
        start_date = datetime(today.year - age - 1, today.month, today.day)
        end_date = datetime(today.year - age, today.month, today.day)
        return await DB.find_documents("users", {
            "birthday": {
                "$gte": start_date,
                "$lt": end_date
            }
        })

    @staticmethod
    async def update_roles(email, roles):
        if not await UserHandler.is_user(email):
            print(f"User with this email does not exist: {email}")
            return

        try:
            await DB.update_document("users", {"email": email}, {
                    "roles": await RoleHandler.names_to_ids(roles)
            })
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    async def delete_user(email):
        try:
            await DB.delete_documents("users", {"email": email})
        except Exception as e:
            print(f"An error occurred:\n {e}")