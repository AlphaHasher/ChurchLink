from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from bson import ObjectId
from mongo.database import DB
# Import the refactored roles functions
from models.roles import get_role_ids_from_names, get_roles_with_permissions

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

    # Add model config to allow ObjectId
    model_config = ConfigDict(arbitrary_types_allowed=True)

class UserCreate(UserBase):
    # Input roles as names, will be converted to ObjectIds before saving
    roles_in: List[str] = Field(..., alias="roles") # Expect 'roles' in input as list of names

    # Exclude the direct 'roles' field from the input model if conversion happens separately
    # Also exclude createdOn as it's set automatically
    model_config = ConfigDict(
        # exclude={"roles", "createdOn"}, # createdOn handled by default_factory
        exclude={"roles"}, 
        arbitrary_types_allowed=True # Inherited, but good to be explicit if needed elsewhere
    )

class UserOut(UserBase):
    id: str # Output id as string
    # UserOut inherits model_config from UserBase

# CRUD Operations as top-level async functions

async def create_user(user_data: UserCreate) -> Optional[UserOut]:
    """
    Creates a new user in the database using DB.insert_document.
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

        # Use the helper method to insert
        inserted_id = await DB.insert_document("users", user_dict)

        if inserted_id:
            # Fetch the created user to return it as UserOut
            created_user_doc = await DB.db["users"].find_one({"_id": inserted_id})
            if created_user_doc:
                created_user_doc["id"] = str(created_user_doc.pop("_id"))
                return UserOut(**created_user_doc)
        # Return None if insertion or fetching failed
        return None
    except Exception as e:
        # The insert_document method already prints errors, but we can add more context
        print(f"An error occurred during the create_user process: {e}")
        return None

async def get_user_by_id(user_id: str) -> Optional[UserOut]:
    """
    Retrieves a user by their MongoDB ObjectId string.
    (Uses find_one directly as it targets a unique _id)
    """
    try:
        # Use find_one directly for specific ID lookup
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
    (Uses find_one directly as email is expected to be unique)
    """
    try:
        # Use find_one directly for unique email lookup
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
    Finds all users associated with a specific role ID using DB.find_documents.
    """
    users_out = []
    try:
        obj_role_id = ObjectId(role_id)
        # Use find_documents helper
        user_docs = await DB.find_documents("users", {"roles": obj_role_id})
        for user_doc in user_docs:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by role ID: {e}")
        return []


async def find_users_with_permissions(permission_names: List[str]) -> List[UserOut]:
    """
    Finds users with roles granting specified permissions using DB.find_documents.
    Uses the refactored get_roles_with_permissions function.
    """
    users_out = []
    try:
        roles_with_perms = await get_roles_with_permissions(permission_names)
        role_ids = [ObjectId(role.id) for role in roles_with_perms]

        if not role_ids:
            return []

        # Use find_documents helper
        user_docs = await DB.find_documents("users", {"roles": {"$in": role_ids}})
        for user_doc in user_docs:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by permissions: {e}")
        return []


# Example finders (add more as needed based on the original UserHandler)
async def find_users_by_first_name(first_name: str) -> List[UserOut]:
    """
    Finds users by first name using DB.find_documents.
    """
    users_out = []
    try:
        # Use find_documents helper
        user_docs = await DB.find_documents("users", {"first_name": first_name})
        for user_doc in user_docs:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by first name: {e}")
        return []

async def find_users_by_last_name(last_name: str) -> List[UserOut]:
    """
    Finds users by last name using DB.find_documents.
    """
    users_out = []
    try:
        # Use find_documents helper
        user_docs = await DB.find_documents("users", {"last_name": last_name})
        for user_doc in user_docs:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by last name: {e}")
        return []


async def update_user_roles(email: EmailStr, role_names: List[str]) -> bool:
    """
    Updates the roles for a user specified by email.
    (Uses update_one directly to target a specific email)
    Replaces the existing roles list with the new one derived from role_names.
    """
    try:
        role_ids = await get_role_ids_from_names(role_names)
        if len(role_ids) != len(role_names):
            print(f"Warning: Some roles for user {email} were not found during update.")

        # Use update_one directly for specific email update
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
    (Uses delete_one directly to target a specific _id)
    """
    try:
        # Use delete_one directly for specific ID deletion
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
    """
    Finds users within a specific age range using DB.find_documents.
    """
    users_out = []
    try:
        today = datetime.now()
        start_date = datetime(today.year - age - 1, today.month, today.day)
        end_date = datetime(today.year - age, today.month, today.day)

        query = {
            "birthday": {
                "$gte": start_date,
                "$lt": end_date
            }
        }
        # Use find_documents helper
        user_docs = await DB.find_documents("users", query)
        for user_doc in user_docs:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        print(f"An error occurred finding users by age: {e}")
        return []