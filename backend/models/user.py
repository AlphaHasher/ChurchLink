from typing import Optional, List, Literal, Dict
from datetime import datetime
from pydantic import (
    BaseModel, Field, EmailStr, ConfigDict
)
from bson import ObjectId
from mongo.database import DB
# Import the refactored roles functions
from models.roles_models import get_role_ids_from_names, get_roles_with_permissions
# Import UserHandler for family member operations
from mongo.churchuser import UserHandler
from models.base.ssbc_base_model import PydanticObjectId

# Use shared PydanticObjectId from base model

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
    verified: bool
    membership: bool
    language: str = Field(default="en", min_length=2, max_length=5)
    phone: Optional[str] = None
    birthday: Optional[datetime] = None
    address: AddressSchema = Field(default_factory=AddressSchema)
    roles: List[PydanticObjectId] = Field(default_factory=list)
    ministries: List[str] = Field(default_factory=list)
    favorite_events: List[str] = Field(default_factory=list)
    createdOn: datetime = Field(default_factory=datetime.now)
    notification_preferences: Optional[dict] = Field(default_factory=dict, description="User notification opt-out settings")

class UserCreate(UserBase):
    # Input roles as names, will be converted to ObjectIds before saving
    roles_in: List[str] = Field(..., alias="roles") # Expect 'roles' in input as list of names

    # Exclude the direct 'roles' field from the input model if conversion happens separately
    model_config = ConfigDict(
        exclude={"roles"}
    )

class UserOut(UserBase):
    id: str # Output id as string

class FamilyMemberIDTag(BaseModel):
    id: str

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

async def get_user_by_uid(uid: str) -> Optional[UserOut]:
    """
    Retrieves a user by their UID (assuming 'uid' is a unique field in the user document).
    (Uses find_one directly as uid is expected to be unique)
    """
    try:
        # Use find_one directly for unique uid lookup
        user_doc = await DB.db["users"].find_one({"uid": uid})
        if user_doc:
            user_doc["id"] = str(user_doc.pop("_id"))
            return UserOut(**user_doc)
        return None
    except Exception as e:
        print(f"An error occurred fetching user by UID: {e}")
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

# --- Renamed and Refined Get Users Function --- 
async def get_users(
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    age: Optional[int] = None,
    role_id: Optional[str] = None, # Input as string, convert to ObjectId
    skip: int = 0,
    limit: Optional[int] = 100 # Default limit, use None for no limit
) -> List[UserOut]:
    """
    Finds a list of users based on various optional non-unique criteria.
    Supports pagination using skip and limit.
    Use get_user_by_id or get_user_by_email for single user lookups by unique fields.
    """
    query = {}
    
    if first_name:
        query["first_name"] = first_name
    if last_name:
        query["last_name"] = last_name
    # Removed email query logic
    if role_id:
        try:
            query["roles"] = ObjectId(role_id)
        except Exception:
             print(f"Invalid role_id format provided to get_users: {role_id}")
             return []
    if age is not None:
        if age < 0:
            print("Age must be non-negative")
            return []
        today = datetime.now()
        start_date = datetime(today.year - age - 1, today.month, today.day)
        end_date = datetime(today.year - age, today.month, today.day)
        query["birthday"] = {"$gte": start_date, "$lt": end_date}

    # If query is empty, it implies fetching all users (respecting pagination)
    # We might want different behavior, e.g., require at least one filter?
    # For now, allowing empty query to list users.
    # if not query:
    #     print("Warning: get_users called without any search criteria.")
    #     return [] 

    users_out = []
    try:
        cursor = DB.db["users"].find(query)
        
        # Apply pagination
        if skip > 0:
            cursor = cursor.skip(skip)
        effective_limit = limit if limit is not None else 0
        if effective_limit > 0:
             cursor = cursor.limit(effective_limit)

        user_docs = await cursor.to_list(length=effective_limit if effective_limit > 0 else None)
        
        for user_doc in user_docs:
            user_doc["id"] = str(user_doc.pop("_id"))
            users_out.append(UserOut(**user_doc))
        return users_out
    except Exception as e:
        # Renamed function name in error message
        print(f"An error occurred during get_users: {e}") 
        return []

# --- Keep permission-based search separate as it involves role lookup --- 
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

# --- User Modification/Deletion --- 
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


# Family Member Models for Person Management

class PersonCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50) 
    gender: Literal["M", "F"]
    date_of_birth: datetime

class PersonOut(BaseModel):
    id: str  # ObjectId converted to string
    first_name: str
    last_name: str
    gender: str
    date_of_birth: datetime
    created_on: datetime = Field(..., alias="createdOn")

class PersonUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    gender: Optional[Literal["M", "F"]] = None
    date_of_birth: Optional[datetime] = None

class PersonUpdateRequest(PersonUpdate):
    id: str


# Family Member Database Functions - Direct Wrappers for UserHandler

async def add_family_member(user_uid: str, person_data: PersonCreate) -> Optional[PersonOut]:
    """
    Adds a family member to a user's family list.
    (Direct wrapper for UserHandler.add_person_to_user)
    """
    try:
        person_id = await UserHandler.add_person_to_user(
            user_uid, 
            person_data.first_name, 
            person_data.last_name, 
            person_data.gender, 
            person_data.date_of_birth
        )
        if person_id:
            # Get created person and convert to PersonOut
            person = await UserHandler.get_person(user_uid, person_id)
            if person:
                person['id'] = str(person.pop('_id'))
                return PersonOut(**person)
        return None
    except Exception as e:
        print(f"An error occurred adding family member: {e}")
        return None

async def get_family_members(user_uid: str) -> List[PersonOut]:
    """
    Retrieves all family members for a user.
    (Direct wrapper for UserHandler.list_people)
    """
    try:
        people = await UserHandler.list_people(user_uid)
        result = []
        for person in people:
            person['id'] = str(person.pop('_id'))
            # Add createdOn if missing (for backwards compatibility with older data)
            if 'createdOn' not in person:
                person['createdOn'] = datetime.now()
            result.append(PersonOut(**person))
        return result
    except Exception as e:
        print(f"An error occurred retrieving family members: {e}")
        return []

async def get_family_member_by_id(user_uid: str, person_id: str) -> Optional[PersonOut]:
    """
    Retrieves a specific family member by their ID.
    (Direct wrapper for UserHandler.get_person)
    """
    try:
        person = await UserHandler.get_person(user_uid, ObjectId(person_id))
        if person:
            person['id'] = str(person.pop('_id'))
            # Add createdOn if missing (for backwards compatibility with older data)
            if 'createdOn' not in person:
                person['createdOn'] = datetime.now()
            return PersonOut(**person)
        return None
    except Exception as e:
        print(f"An error occurred retrieving family member by ID: {e}")
        return None

async def update_family_member(user_uid: str, person_id: str, updates: PersonUpdate) -> bool:
    """
    Updates a family member's information.
    (Direct wrapper for UserHandler.update_person)
    """
    try:
        update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
        if not update_dict:
            print("No updates provided for family member")
            return False
        return await UserHandler.update_person(user_uid, ObjectId(person_id), update_dict)
    except Exception as e:
        print(f"An error occurred updating family member: {e}")
        return False

async def delete_family_member(user_uid: str, person_id: str) -> bool:
    """
    Removes a family member from a user's family list.
    (Direct wrapper for UserHandler.remove_person)
    """
    try:
        return await UserHandler.remove_person(user_uid, ObjectId(person_id))
    except Exception as e:
        print(f"An error occurred deleting family member: {e}")
        return False

async def get_person_dict(uid: str) -> Dict[str, dict]:
    """
    Build a map of people related to the user:
      - Key 'SELF' => the primary user's details
      - Key '<person_id>' => each family member's details (ObjectId as str)

    Values contain: first_name, last_name, DOB, gender.
    For the user, DOB comes from 'birthday'; for family members, from 'date_of_birth'.
    """
    try:
        # Fetch only the fields we need from the user
        user_doc = await DB.db["users"].find_one(
            {"uid": uid},
            {"first_name": 1, "last_name": 1, "birthday": 1, "gender": 1}
        )
        if not user_doc:
            return {}

        person_map: Dict[str, dict] = {
            "SELF": {
                "first_name": user_doc.get("first_name"),
                "last_name": user_doc.get("last_name"),
                "DOB": user_doc.get("birthday"),
                "gender": user_doc.get("gender"),
            }
        }

        # Pull embedded family members via the existing handler
        people = await UserHandler.list_people(uid) or []
        for person in people:
            pid = str(person.get("_id"))
            person_map[pid] = {
                "first_name": person.get("first_name"),
                "last_name": person.get("last_name"),
                "DOB": person.get("date_of_birth"),
                "gender": person.get("gender"),
            }

        return person_map
    except Exception as e:
        print(f"get_person_dict error for uid={uid}: {e}")
        return {}
