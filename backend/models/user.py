from typing import Optional, List, Any, Annotated
from datetime import datetime
from pydantic import (
    BaseModel, Field, EmailStr, ConfigDict, 
    GetCoreSchemaHandler, GetJsonSchemaHandler
)
from pydantic_core import core_schema
from bson import ObjectId
from mongo.database import DB
# Import the refactored roles functions
from models.roles import get_role_ids_from_names, get_roles_with_permissions

# Custom Pydantic type for handling BSON ObjectId
class _ObjectIdPydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        """
        Defines how to validate the ObjectId. 
        Accepts ObjectId instances directly or attempts to validate from a string.
        """
        def validate_from_str(v: str) -> ObjectId:
            try:
                return ObjectId(v)
            except Exception:
                # Catch specific exceptions if needed (e.g., bson.errors.InvalidId)
                raise ValueError(f"Invalid ObjectId string format: '{v}'")

        # Schema for validating from a string input
        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.union_schema(
            [
                # Allow ObjectId instances directly during model creation/validation
                core_schema.is_instance_schema(ObjectId),
                # Allow validation from string input
                from_str_schema,
            ],
            # Always serialize to string representation
            serialization=core_schema.plain_serializer_function_ser_schema(lambda x: str(x)),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> dict:
        """
        Defines the JSON schema representation for ObjectId as a string.
        """
        # Use the existing string schema handler and add the 'objectid' format
        json_schema = handler(core_schema.str_schema())
        json_schema.update({'type': 'string', 'format': 'objectid'})
        return json_schema

# Annotated type using the custom class
PydanticObjectId = Annotated[ObjectId, _ObjectIdPydanticAnnotation]

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
    roles: List[PydanticObjectId] = Field(default_factory=list)
    bible_notes: List[str] = Field(default_factory=list)
    createdOn: datetime = Field(default_factory=datetime.now)

class UserCreate(UserBase):
    # Input roles as names, will be converted to ObjectIds before saving
    roles_in: List[str] = Field(..., alias="roles") # Expect 'roles' in input as list of names

    # Exclude the direct 'roles' field from the input model if conversion happens separately
    model_config = ConfigDict(
        exclude={"roles"}
    )

class UserOut(UserBase):
    id: str # Output id as string

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

