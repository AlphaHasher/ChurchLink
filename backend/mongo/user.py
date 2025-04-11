from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
from database import DB
# Import the refactored roles functions
from mongo.roles import get_role_ids_from_names, get_roles_with_permissions

# Pydantic Models for User Data
class AddressSchema(BaseModel):
    address: Optional[str] = None
    suite: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    birthday: Optional[datetime] = None
    address: AddressSchema = Field(default_factory=AddressSchema)
    roles: List[ObjectId] # Store role ObjectIds directly
    bible_notes: List[str] = Field(default_factory=list)
    createdOn: datetime = Field(default_factory=datetime.now)

class UserCreate(UserBase):
    # Input roles as names, will be converted to ObjectIds before saving
    roles_in: List[str] = Field(..., alias="roles") # Expect 'roles' in input as list of names

    # Exclude the direct 'roles' field from the input model if conversion happens separately
    model_config = {
        "exclude": {"roles"}
    }

class UserOut(UserBase):
    id: str # Output id as string

# CRUD Operations as top-level async functions

async def create_user(user_data: UserCreate) -> Optional[UserOut]:
    """
    Creates a new user in the database.
    Converts role names provided in 'roles_in' to ObjectIds before storing.
    """
    existing_user = await DB.db["users"].find_one({"email": user_data.email})
    if existing_user:
        print(f"User with this email already exists: {user_data.email}")
        return None

    try:
        # Convert role names to ObjectIds
        role_ids = await get_role_ids_from_names(user_data.roles_in)
        if len(role_ids) != len(user_data.roles_in):
             print(f"Warning: Some roles for user {user_data.email} were not found and skipped.")

        # Create the user document data, excluding 'roles_in' and including converted 'roles'
        user_dict = user_data.model_dump(exclude={"roles_in"})
        user_dict["roles"] = role_ids
        user_dict["createdOn"] = datetime.now() # Ensure creation time is set now

        result = await DB.db["users"].insert_one(user_dict)
        created_user_doc = await DB.db["users"].find_one({"_id": result.inserted_id})

        if created_user_doc:
            created_user_doc["id"] = str(created_user_doc.pop("_id"))
            return UserOut(**created_user_doc)
        return None
    except Exception as e:
        print(f"An error occurred during user creation: {e}")
        return None

async def get_user_by_id(user_id: str) -> Optional[UserOut]:
    """
    Retrieves a user by their MongoDB ObjectId string.
    """
    try:
        user_doc = await DB.db["users"].find_one({"_id": ObjectId(user_id)})
        if user_doc:
            user_doc["id"] = str(user_doc.pop("_id"))
            return UserOut(**user_doc)
        return None
    except Exception as e:
        print(f"An error occurred fetching user by ID: {e}")
        return None


async def get_user_by_email(email: EmailStr) -> Optional[UserOut]:
    """
    Retrieves a user by their email address.
    """
    try:
        user_doc = await DB.db["users"].find_one({"email": email})
        if user_doc:
            user_doc["id"] = str(user_doc.pop("_id"))
            return UserOut(**user_doc)
        return None
    except Exception as e:
        print(f"An error occurred fetching user by email: {e}")
        return None


async def find_users_with_role_id(role_id: str) -> List[UserOut]:
    """
    Finds all users associated with a specific role ID.
    """
    users_out = []
    try:
        # Ensure role_id is a valid ObjectId string before querying
        obj_role_id = ObjectId(role_id)
        cursor = DB.db["users"].find({"roles": obj_role_id}) # Query using the ObjectId
        async for user_doc in cursor:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by role ID: {e}")
        return []


async def find_users_with_permissions(permission_names: List[str]) -> List[UserOut]:
    """
    Finds all users who have roles granting *all* the specified permissions.
    Uses the refactored get_roles_with_permissions function.
    """
    users_out = []
    try:
        # Find roles that have the required permissions
        roles_with_perms = await get_roles_with_permissions(permission_names)
        role_ids = [ObjectId(role.id) for role in roles_with_perms] # Get ObjectIds

        if not role_ids:
            return [] # No roles grant these permissions

        # Find users whose roles array contains *any* of the found role IDs
        # Note: If a user needs ALL roles granting the permission, the logic would change.
        # This finds users who have AT LEAST ONE role granting the permissions.
        cursor = DB.db["users"].find({"roles": {"$in": role_ids}})
        async for user_doc in cursor:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by permissions: {e}")
        return []


# Example finders (add more as needed based on the original UserHandler)
async def find_users_by_first_name(first_name: str) -> List[UserOut]:
    users_out = []
    try:
        cursor = DB.db["users"].find({"first_name": first_name})
        async for user_doc in cursor:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by first name: {e}")
        return []

async def find_users_by_last_name(last_name: str) -> List[UserOut]:
    users_out = []
    try:
        cursor = DB.db["users"].find({"last_name": last_name})
        async for user_doc in cursor:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by last name: {e}")
        return []


async def update_user_roles(email: EmailStr, role_names: List[str]) -> bool:
    """
    Updates the roles for a user specified by email.
    Replaces the existing roles list with the new one derived from role_names.
    """
    try:
        role_ids = await get_role_ids_from_names(role_names)
        if len(role_ids) != len(role_names):
            print(f"Warning: Some roles for user {email} were not found during update.")

        result = await DB.db["users"].update_one(
            {"email": email},
            {"$set": {"roles": role_ids}}
        )
        if result.matched_count == 0:
            print(f"User with email {email} not found for role update.")
            return False
        return result.modified_count > 0
    except Exception as e:
        print(f"An error occurred updating user roles: {e}")
        return False


async def delete_user(user_id: str) -> bool:
    """
    Deletes a user by their ID.
    """
    try:
        result = await DB.db["users"].delete_one({"_id": ObjectId(user_id)})
        if result.deleted_count == 0:
             print(f"User with ID {user_id} not found for deletion.")
        return result.deleted_count > 0
    except Exception as e:
        print(f"An error occurred deleting user: {e}")
        return False

# Add other necessary functions like update_user_profile, find_by_phone, find_by_age etc.
# following the same pattern: Pydantic models for input/output, top-level async function.
# Example:
async def find_users_by_age(age: int) -> List[UserOut]:
    users_out = []
    try:
        today = datetime.now()
        # Calculate start and end dates for the age range
        start_date = datetime(today.year - age - 1, today.month, today.day)
        end_date = datetime(today.year - age, today.month, today.day)

        cursor = DB.db["users"].find({
            "birthday": {
                "$gte": start_date,
                "$lt": end_date
            }
        })
        async for user_doc in cursor:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by age: {e}")
        return []