from fastapi import APIRouter, Body, Path, HTTPException
from mongo.database import DB
from bson import ObjectId, errors as bson_errors
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CustomComponentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    puckData: dict = Field(...)  # The component's Puck data structure


class CustomComponentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    puckData: Optional[dict] = None
    locked: Optional[bool] = None


custom_components_router = APIRouter(prefix="/page-components", tags=["custom components"])


@custom_components_router.get("/")
async def list_custom_components():
    """List all custom component templates."""
    cursor = DB.db["page-custom-components"].find().sort("created_at", -1)
    components = await cursor.to_list(length=100)
    for comp in components:
        comp["_id"] = str(comp["_id"])
    return components


@custom_components_router.get("/{component_id}")
async def get_custom_component(component_id: str = Path(...)):
    """Get a single custom component by ID."""
    try:
        object_id = ObjectId(component_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid component ID format")

    component = await DB.db["page-custom-components"].find_one({"_id": object_id})
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    component["_id"] = str(component["_id"])
    return component


@custom_components_router.post("/")
async def create_custom_component(data: CustomComponentCreate = Body(...)):
    """Create a new custom component template."""
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    # Check for duplicate name
    existing = await DB.db["page-custom-components"].find_one({"name": data.name})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A component with this name already exists. Please choose a different name.",
        )

    component_data = {
        "name": data.name.strip(),
        "description": data.description.strip() if data.description else None,
        "puckData": data.puckData,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await DB.db["page-custom-components"].insert_one(component_data)
    return {"_id": str(result.inserted_id), "name": data.name}


@custom_components_router.put("/{component_id}")
async def update_custom_component(
    component_id: str = Path(...), data: CustomComponentUpdate = Body(...)
):
    """Update an existing custom component template."""
    try:
        object_id = ObjectId(component_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid component ID format")

    update_data = {"updated_at": datetime.utcnow()}

    if data.name is not None:
        if not data.name.strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        # Check for duplicate name (excluding current component)
        existing = await DB.db["page-custom-components"].find_one(
            {"name": data.name, "_id": {"$ne": object_id}}
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="A component with this name already exists.",
            )
        update_data["name"] = data.name.strip()

    if data.description is not None:
        update_data["description"] = data.description.strip() if data.description else None

    if data.puckData is not None:
        update_data["puckData"] = data.puckData

    if data.locked is not None:
        update_data["locked"] = data.locked

    result = await DB.db["page-custom-components"].update_one(
        {"_id": object_id}, {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Component not found")

    return {"matched": result.matched_count, "modified": result.modified_count}


@custom_components_router.delete("/{component_id}")
async def delete_custom_component(component_id: str = Path(...)):
    """Delete a custom component template."""
    try:
        object_id = ObjectId(component_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid component ID format")

    # Check if component is locked
    component = await DB.db["page-custom-components"].find_one({"_id": object_id})
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    if component.get("locked", False):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete locked component. Unlock it first."
        )

    result = await DB.db["page-custom-components"].delete_one({"_id": object_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Component not found")

    return {"deleted": result.deleted_count}


@custom_components_router.post("/{component_id}/duplicate")
async def duplicate_custom_component(component_id: str = Path(...)):
    """Duplicate a custom component template."""
    try:
        object_id = ObjectId(component_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid component ID format")

    original = await DB.db["page-custom-components"].find_one({"_id": object_id})
    if not original:
        raise HTTPException(status_code=404, detail="Component not found")

    # Create unique name with "(Copy)" suffix
    base_name = original["name"]
    new_name = f"{base_name} (Copy)"

    counter = 1
    while await DB.db["page-custom-components"].find_one({"name": new_name}):
        counter += 1
        new_name = f"{base_name} (Copy {counter})"

    duplicate_data = {
        "name": new_name,
        "description": original.get("description"),
        "puckData": original["puckData"],
        "locked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await DB.db["page-custom-components"].insert_one(duplicate_data)
    created = await DB.db["page-custom-components"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created
