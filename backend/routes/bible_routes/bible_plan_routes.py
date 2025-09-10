from fastapi import APIRouter, Request, HTTPException, status, Query
from typing import List

from models.bible_plan import (
    ReadingPlanCreate,
    ReadingPlanOut,
    ReadingPlanUpdate,
    create_reading_plan,
    list_reading_plans,
    get_reading_plan_by_id,
    update_reading_plan,
    delete_reading_plan,
)


bible_plan_router = APIRouter(prefix="/bible-plans", tags=["Bible Plans"])


@bible_plan_router.post("/", response_model=ReadingPlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(plan: ReadingPlanCreate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    created = await create_reading_plan(plan, uid)
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create plan")
    return created


@bible_plan_router.get("/", response_model=List[ReadingPlanOut])
async def list_plans(request: Request, skip: int = 0, limit: int = Query(100, le=500)) -> List[ReadingPlanOut]:
    uid = request.state.uid
    return await list_reading_plans(uid, skip=skip, limit=limit)


@bible_plan_router.get("/{plan_id}", response_model=ReadingPlanOut)
async def get_plan(plan_id: str, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    plan = await get_reading_plan_by_id(plan_id, uid)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


@bible_plan_router.put("/{plan_id}", response_model=ReadingPlanOut)
async def update_plan(plan_id: str, update: ReadingPlanUpdate, request: Request) -> ReadingPlanOut:
    uid = request.state.uid
    updated = await update_reading_plan(plan_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or update failed")
    return updated


@bible_plan_router.delete("/{plan_id}")
async def remove_plan(plan_id: str, request: Request) -> dict:
    uid = request.state.uid
    ok = await delete_reading_plan(plan_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return {"message": "Plan deleted"}