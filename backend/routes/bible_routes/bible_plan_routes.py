from fastapi import APIRouter, Request, HTTPException, status
from typing import List
from bson import ObjectId

from mongo.database import DB
from models.bible_plan import _convert_plan_doc_to_out

from models.bible_plan import (
    ReadingPlanCreate,
    ReadingPlanOut,
    ReadingPlanUpdate,
    ReadingPlanTemplateOut,
    create_reading_plan,
    get_reading_plans_from_user,
    update_reading_plan,
    delete_reading_plan,
    get_all_reading_plans,
    duplicate_reading_plan,
    get_all_bible_plan_templates,
    get_bible_plan_template_by_name,
    get_bible_plan_template_by_id,
    get_published_reading_plans,
    create_template_from_plan,
    update_bible_plan_template,
    delete_bible_plan_template,
)


public_bible_plan_router = APIRouter(prefix="/bible-plans", tags=["Bible Plans Public"])
mod_bible_plan_router = APIRouter(prefix="/bible-plans", tags=["Bible Plans"])
private_bible_plan_router = APIRouter(prefix="/bible-plans", tags=["Bible Plans Private"])


# SPECIFIC ROUTES (must come before generic /{plan_id} routes)
# ============================================================

# Get all published Bible plans (visible=True)
@public_bible_plan_router.get("/published", response_model=List[ReadingPlanOut])
async def list_published_plans() -> List[ReadingPlanOut]:
    """Get all published Bible plans that are visible to users"""
    return await get_published_reading_plans()


# Create a new Bible plan
@mod_bible_plan_router.post("/", response_model=ReadingPlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(plan: ReadingPlanCreate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    created = await create_reading_plan(plan, uid)
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create plan")
    return created

# Get all plans from all users (admin view)
@mod_bible_plan_router.get("/", response_model=List[ReadingPlanOut])
async def list_all_plans(request: Request) -> List[ReadingPlanOut]:
    """Get all bible plans from all users (for admin management)"""
    return await get_all_reading_plans()

# Get all Bible plan templates
@mod_bible_plan_router.get("/templates", response_model=List[ReadingPlanTemplateOut])
async def list_bible_plan_templates():
    """Get all available Bible plan templates"""
    try:
        templates = await get_all_bible_plan_templates()
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch templates: {str(e)}")

# Get Bible plan template by ID
@mod_bible_plan_router.get("/templates/id/{template_id}", response_model=ReadingPlanTemplateOut)
async def get_bible_plan_template_by_id_endpoint(template_id: str):
    template = await get_bible_plan_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template with id '{template_id}' not found")
    return template

# Get Bible plan template by name
@mod_bible_plan_router.get("/templates/{template_name}", response_model=ReadingPlanTemplateOut)
async def get_bible_plan_template(template_name: str):
    """Get a specific Bible plan template by name"""
    try:
        template = await get_bible_plan_template_by_name(template_name)
        if not template:
            raise HTTPException(status_code=404, detail=f"Template with name '{template_name}' not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch template: {str(e)}")

# Update template name
@mod_bible_plan_router.patch("/templates/{template_id}", response_model=ReadingPlanTemplateOut)
async def update_template(template_id: str, name: str) -> ReadingPlanTemplateOut:
    """Update a Bible plan template's name"""
    updated = await update_bible_plan_template(template_id, name)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found or update failed")
    return updated

# Delete template
@mod_bible_plan_router.delete("/templates/{template_id}")
async def delete_template(template_id: str) -> dict:
    """Delete a Bible plan template"""
    ok = await delete_bible_plan_template(template_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return {"message": "Template deleted"}

# Get all plans from a specific user
@mod_bible_plan_router.get("/user/{user_id}", response_model=List[ReadingPlanOut])
async def get_user_plans(user_id: str) -> List[ReadingPlanOut]:
    plans = await get_reading_plans_from_user(user_id)
    return plans

# Duplicate a plan (specific path, must come before generic /{plan_id})
@mod_bible_plan_router.post("/{plan_id}/duplicate", response_model=ReadingPlanOut, status_code=status.HTTP_201_CREATED)
async def duplicate_plan(plan_id: str, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    duplicated = await duplicate_reading_plan(plan_id, uid)
    if not duplicated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or duplication failed")
    return duplicated

# Make template from plan (specific path, must come before generic /{plan_id})
@mod_bible_plan_router.post("/{plan_id}/make-template", response_model=ReadingPlanTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template_from_plan_endpoint(plan_id: str, request: Request) -> ReadingPlanTemplateOut:
    """Create a template from an existing Bible plan"""
    uid = request.state.uid
    template = await create_template_from_plan(plan_id, uid)
    if not template:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create template")
    return template

# Get plan by ID (by-id endpoint - specific, comes before generic /{plan_id})
@private_bible_plan_router.get("/by-id/{plan_id}", response_model=ReadingPlanOut)
async def get_plan_private(plan_id: str, request: Request) -> ReadingPlanOut:
    """Allow the authenticated owner of a plan to fetch it (no mod role required)."""
    uid = request.state.uid
    try:
        pid = ObjectId(plan_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Bible plan ID")

    doc = await DB.db.bible_plans.find_one({"_id": pid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    # Allow if owner or if plan is published (visible=True)
    if doc.get("user_id") == uid or doc.get("visible", False):
        return _convert_plan_doc_to_out(doc)

    # Fake 404 to avoid leaking existence of plan to non-owners
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

@mod_bible_plan_router.put("/by-id/{plan_id}", response_model=ReadingPlanOut)
async def update_plan(plan_id: str, update: ReadingPlanUpdate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    updated = await update_reading_plan(plan_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or update failed")
    return updated

# PATCH for partial updates (e.g., toggling visibility)
@mod_bible_plan_router.patch("/by-id/{plan_id}", response_model=ReadingPlanOut)
async def patch_plan(plan_id: str, update: ReadingPlanUpdate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    updated = await update_reading_plan(plan_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or update failed")
    return updated

# Delete plan
@mod_bible_plan_router.delete("/by-id/{plan_id}")
async def remove_plan(plan_id: str, request: Request) -> dict:
    uid = request.state.uid
    ok = await delete_reading_plan(plan_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return {"message": "Plan deleted"}

# GENERIC ROUTES (must come AFTER specific routes)
# ================================================

# Get plan by ID (generic endpoint for simple ID access)
# Only matches actual MongoDB ObjectIDs, not paths like /templates, /user, etc.
@private_bible_plan_router.get("/{plan_id:regex(^[0-9a-f]{24}$)}", response_model=ReadingPlanOut)
async def get_plan(plan_id: str, request: Request) -> ReadingPlanOut:
    """Fetch a Bible plan by its ID."""
    uid = request.state.uid
    try:
        pid = ObjectId(plan_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Bible plan ID")

    doc = await DB.db.bible_plans.find_one({"_id": pid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    # Allow if owner or if plan is published (visible=True)
    if doc.get("user_id") == uid or doc.get("visible", False):
        return _convert_plan_doc_to_out(doc)

    # Fake 404 to avoid leaking existence of plan to non-owners
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

# Update plan by ID (generic endpoint)
@mod_bible_plan_router.put("/{plan_id:regex(^[0-9a-f]{24}$)}", response_model=ReadingPlanOut)
async def update_plan_generic(plan_id: str, update: ReadingPlanUpdate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    updated = await update_reading_plan(plan_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or update failed")
    return updated

# PATCH for partial updates (generic endpoint)
@mod_bible_plan_router.patch("/{plan_id:regex(^[0-9a-f]{24}$)}", response_model=ReadingPlanOut)
async def patch_plan_generic(plan_id: str, update: ReadingPlanUpdate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    updated = await update_reading_plan(plan_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or update failed")
    return updated

# Delete plan by ID (generic endpoint)
@mod_bible_plan_router.delete("/{plan_id:regex(^[0-9a-f]{24}$)}")
async def delete_plan(plan_id: str, request: Request) -> dict:
    uid = request.state.uid
    ok = await delete_reading_plan(plan_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return {"message": "Plan deleted"}

