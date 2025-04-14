from bson import ObjectId

from mongo.database import DB
from datetime import datetime
from mongo.roles import RoleHandler

class UserHandler:
    @staticmethod
    async def is_user(uid):
        return len(await DB.find_documents("users", {"uid": uid})) > 0

    ################
    ## Operations ##
    ################
    @staticmethod
    async def create_schema(first_name, last_name, email, uid, roles, phone=None, birthday=None, address=None):
        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "uid": uid,
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
    async def create_user(first_name, last_name, email, uid, roles, phone=None, birthday=None, address=None):
        """
        'roles' is a list of role names
        """
        if await UserHandler.is_user(uid):
            print(f"User with this uid already exists: {uid}")
            return

        try:
            await DB.insert_document("users", await UserHandler.create_schema(
                first_name,
                last_name,
                email,
                uid,
                roles,
                phone,
                birthday,
                address
            ))
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    async def find_all_users():
        return await DB.find_documents("users", {})

    @staticmethod
    async def find_users_with_role_id(role_id):
        return await DB.find_documents("users", {"roles": role_id})

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
    async def find_by_uid(uid):
        docs = await DB.find_documents("users", {"uid": uid}, 1)
        if len(docs) == 0:
            return False
        return docs[0]
    
    @staticmethod
    async def does_user_have_permissions(uid):
        user = await UserHandler.find_by_uid(uid)
        if user == None:
            return False
        return len(user['roles']) > 0


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
    async def update_user(filterQuery, updateData):
        return await DB.update_document("users", filterQuery, updateData)

    @staticmethod
    async def update_roles(uid, roles, strapiSyncFunction):
        if not await UserHandler.is_user(uid):
            print(f"User with this uid does not exist: {uid}")
            return False

        try:
            await DB.update_document("users", {"uid": uid}, {
                    "roles": roles
            })
            return await strapiSyncFunction(uid)
        except Exception as e:
            print(f"An error occurred:\n {e}")
            return False

    @staticmethod
    async def delete_user(email):
        try:
            await DB.delete_documents("users", {"email": email})
        except Exception as e:
            print(f"An error occurred:\n {e}")