from fastapi import APIRouter, Request, HTTPException, status, Query
from typing import List

from models.bible_plan import (
    ReadingPlanCreate,
    ReadingPlanOut,
    ReadingPlanUpdate,
    ReadingPlanTemplateOut,
    create_reading_plan,
    list_reading_plans,
    get_reading_plan_by_id,
    get_reading_plans_from_user,
    update_reading_plan,
    delete_reading_plan,
    get_all_reading_plans,
    duplicate_reading_plan,
    get_all_bible_plan_templates,
    get_bible_plan_template_by_name,
    get_bible_plan_template_by_id,
)


# This is renamed to mod bible plan router because it specifically requires mod permissions.
# Consider changing in future to be based on PermProtectedRouter if specific perm is implemented
# The name is a proactive change because in the future, we will also need public routes, so the name change is pre-empitive
mod_bible_plan_router = APIRouter(prefix="/bible-plans", tags=["Bible Plans"])


# Mod Route
@mod_bible_plan_router.post("/", response_model=ReadingPlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(plan: ReadingPlanCreate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    created = await create_reading_plan(plan, uid)
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create plan")
    return created

# Mod Route - Get all plans from all users (admin view)
@mod_bible_plan_router.get("/", response_model=List[ReadingPlanOut])
async def list_all_plans(request: Request) -> List[ReadingPlanOut]:
    """Get all bible plans from all users (for admin management)"""
    return await get_all_reading_plans()

# Mod Route
@mod_bible_plan_router.get("/templates", response_model=List[ReadingPlanTemplateOut])
async def list_bible_plan_templates():
    """Get all available Bible plan templates"""
    try:
        templates = await get_all_bible_plan_templates()
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch templates: {str(e)}")

# Mod Route
@mod_bible_plan_router.get("/templates/id/{template_id}", response_model=ReadingPlanTemplateOut)
async def get_bible_plan_template_by_id_endpoint(template_id: str):
    template = await get_bible_plan_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template with id '{template_id}' not found")
    return template

# Mod Route
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

# Mod Route
@mod_bible_plan_router.get("/user/{user_id}", response_model=List[ReadingPlanOut])
async def get_user_plans(user_id: str) -> List[ReadingPlanOut]:
    plans = await get_reading_plans_from_user(user_id)
    return plans

# Mod Route
@mod_bible_plan_router.get("/{plan_id}", response_model=ReadingPlanOut)
async def get_plan(plan_id: str, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    plan = await get_reading_plan_by_id(plan_id, uid)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan

# Mod Route
@mod_bible_plan_router.put("/{plan_id}", response_model=ReadingPlanOut)
async def update_plan(plan_id: str, update: ReadingPlanUpdate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    updated = await update_reading_plan(plan_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or update failed")
    return updated

# Mod Route - PATCH for partial updates (e.g., toggling visibility)
@mod_bible_plan_router.patch("/{plan_id}", response_model=ReadingPlanOut)
async def patch_plan(plan_id: str, update: ReadingPlanUpdate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    updated = await update_reading_plan(plan_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or update failed")
    return updated

# Mod Route - Duplicate a plan
@mod_bible_plan_router.post("/{plan_id}/duplicate", response_model=ReadingPlanOut, status_code=status.HTTP_201_CREATED)
async def duplicate_plan(plan_id: str, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    duplicated = await duplicate_reading_plan(plan_id, uid)
    if not duplicated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or duplication failed")
    return duplicated

# Mod Route
@mod_bible_plan_router.delete("/{plan_id}")
async def remove_plan(plan_id: str, request: Request) -> dict:
    uid = request.state.uid
    ok = await delete_reading_plan(plan_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return {"message": "Plan deleted"}

