from typing import Optional, List
from pydantic import BaseModel, Field
from bson import ObjectId
from database import DB


# Pydantic Models for Role Data
class PermissionSchema(BaseModel):
    admin: bool = False
    finance: bool = False
    website_management: bool = False
    event_management: bool = False
    page_management: bool = False


class RoleBase(BaseModel):
    name: str
    permissions: PermissionSchema


class RoleCreate(RoleBase):
    pass


class RoleOut(RoleBase):
    id: str  # Use alias="_id" if automatic mapping is desired, or manual conversion
    # If using manual conversion (like in event.py), keep 'id: str'
    # id: str = Field(..., alias="_id") # Example using alias


# Helper function (optional, could be integrated into create/update)
def create_permission_list(perm_strs: List[str]) -> PermissionSchema:
    perms = PermissionSchema()
    for perm in perm_strs:
        if hasattr(perms, perm):
            setattr(perms, perm, True)
    return perms


# CRUD Operations as top-level async functions


async def create_role(role_data: RoleCreate) -> Optional[RoleOut]:
    """
    Creates a new role in the database.
    """
    existing_role = await DB.db["roles"].find_one({"name": role_data.name})
    if existing_role:
        print(f"Role with this name already exists: {role_data.name}")
        return None

    try:
        result = await DB.db["roles"].insert_one(role_data.model_dump())
        created_role = await DB.db["roles"].find_one({"_id": result.inserted_id})
        if created_role:
            created_role["id"] = str(created_role.pop("_id"))
            return RoleOut(**created_role)
        return None
    except Exception as e:
        print(f"An error occurred during role creation: {e}")
        return None


async def get_role_by_id(role_id: str) -> Optional[RoleOut]:
    """
    Retrieves a role by its MongoDB ObjectId string.
    """
    try:
        role_doc = await DB.db["roles"].find_one({"_id": ObjectId(role_id)})
        if role_doc:
            role_doc["id"] = str(role_doc.pop("_id"))
            return RoleOut(**role_doc)
        return None
    except Exception as e:
        print(f"An error occurred fetching role by ID: {e}")
        return None


async def get_role_by_name(name: str) -> Optional[RoleOut]:
    """
    Retrieves a role by its name.
    """
    try:
        role_doc = await DB.db["roles"].find_one({"name": name})
        if role_doc:
            role_doc["id"] = str(role_doc.pop("_id"))
            return RoleOut(**role_doc)
        return None
    except Exception as e:
        print(f"An error occurred fetching role by name: {e}")
        return None


async def get_roles_with_permissions(permission_names: List[str]) -> List[RoleOut]:
    """
    Finds all roles that have all the specified permissions enabled.
    """
    query = {}
    for perm in permission_names:
        # Ensure the permission exists in the schema to avoid errors
        if perm in PermissionSchema.model_fields:
            query[f"permissions.{perm}"] = True
        else:
            print(f"Warning: Invalid permission name '{perm}' ignored.")

    roles_out = []
    try:
        cursor = DB.db["roles"].find(query)
        async for role_doc in cursor:
            role_doc["id"] = str(role_doc.pop("_id"))
            roles_out.append(RoleOut(**role_doc))
        return roles_out
    except Exception as e:
        print(f"An error occurred fetching roles by permissions: {e}")
        return []


async def update_role(role_id: str, role_update_data: RoleCreate) -> bool:
    """
    Updates an existing role by its ID.
    Note: This replaces the entire role document except for the _id.
    Consider using a different model (e.g., RoleUpdate) for partial updates.
    """
    try:
        # Ensure the name isn't taken by *another* role if it's being changed
        if "name" in role_update_data.model_dump(exclude_unset=True):
            existing_role = await DB.db["roles"].find_one(
                {"name": role_update_data.name, "_id": {"$ne": ObjectId(role_id)}}
            )
            if existing_role:
                print(
                    f"Cannot update role: name '{role_update_data.name}' is already taken."
                )
                return False

        result = await DB.db["roles"].update_one(
            {"_id": ObjectId(role_id)},
            {
                "$set": role_update_data.model_dump(exclude_unset=True)
            },  # Use exclude_unset for partial updates if needed
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"An error occurred updating role: {e}")
        return False


async def delete_role(role_id: str) -> bool:
    """
    Deletes a role by its ID.
    """
    try:
        result = await DB.db["roles"].delete_one({"_id": ObjectId(role_id)})
        return result.deleted_count > 0
    except Exception as e:
        print(f"An error occurred deleting role: {e}")
        return False


# Utility function potentially needed by User model (adapt User model to use this or similar)
async def get_role_ids_from_names(role_names: List[str]) -> List[ObjectId]:
    """
    Converts a list of role names to a list of ObjectIds.
    """
    role_ids = []
    for name in role_names:
        role = await get_role_by_name(name)
        if role:
            role_ids.append(
                ObjectId(role.id)
            )  # Convert string ID back to ObjectId for DB storage
        else:
            print(f"Warning: Role name '{name}' not found, skipped.")
    return role_ids
