from fastapi import APIRouter, Request, HTTPException, status, Body
from typing import Any, Dict, List, Optional
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

from mongo.database import DB
from models.bible_plan_tracker import (
    UserBiblePlanSubscription,
    UserBiblePlanProgress,
    get_user_bible_plans,
    insert_user_bible_plan,
    delete_user_bible_plan,
    update_user_bible_plan_progress,
    update_user_bible_plan_notifications,
    find_user_plan,
    reset_user_bible_plan,
)

# Auth-protected router for user Bible plan operations
auth_bible_plan_router = APIRouter(prefix="/my-bible-plans", tags=["User Bible Plans"])


def _is_rest_day(readings_by_day: Dict[str, Any], day: int) -> bool:
    day_key = str(day)
    day_readings = readings_by_day.get(day_key)
    if not day_readings:
        return True
    if isinstance(day_readings, list):
        return len(day_readings) == 0
    return False


def _next_sequential_day(
    progress: List[dict],
    readings_by_day: Dict[str, Any],
    plan_duration: int,
) -> int:
    progress_by_day = {}
    for entry in progress:
        day_value = entry.get("day")
        if isinstance(day_value, int):
            progress_by_day[day_value] = entry

    max_known_day = max(
        plan_duration,
        max(progress_by_day.keys(), default=0),
    )

    day_pointer = 1
    while day_pointer <= max_known_day:
        if _is_rest_day(readings_by_day, day_pointer):
            day_pointer += 1
            continue

        entry = progress_by_day.get(day_pointer)
        if entry and entry.get("is_completed"):
            day_pointer += 1
            continue
        break

    while day_pointer <= plan_duration and _is_rest_day(readings_by_day, day_pointer):
        day_pointer += 1

    return day_pointer


@auth_bible_plan_router.get("/", response_model=List[UserBiblePlanSubscription])
async def get_my_bible_plans(request: Request) -> List[UserBiblePlanSubscription]:
    """Get all Bible plans the current user is subscribed to"""
    uid = request.state.uid
    subscriptions = await get_user_bible_plans(uid)
    return subscriptions


@auth_bible_plan_router.post("/subscribe")
async def subscribe_to_bible_plan(
    request: Request,
    plan_id: str = Body(...),
    start_date: datetime = Body(...),
    notification_time: Optional[str] = Body(None),
    notification_enabled: bool = Body(True)
):
    """Subscribe the current user to a Bible plan"""
    uid = request.state.uid
    # Check if plan exists
    try:
        plan_object_id = ObjectId(plan_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Bible plan ID")

    plan_doc = await DB.db.bible_plans.find_one({"_id": plan_object_id, "visible": True})
    if not plan_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bible plan not found or not published")
    
    # Check if user is already subscribed
    existing = await find_user_plan(uid, plan_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already subscribed to this plan")
    
    # Create subscription
    subscription = UserBiblePlanSubscription(
        plan_id=plan_id,
        start_date=start_date,
        notification_time=notification_time,
        notification_enabled=notification_enabled,
        progress=[],
        subscribed_at=datetime.now()
    )
    
    inserted = await insert_user_bible_plan(uid, subscription)

    if not inserted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to subscribe to plan")
    
    return {"success": True, "message": "Successfully subscribed to Bible plan"}


@auth_bible_plan_router.delete("/unsubscribe/{plan_id}")
async def unsubscribe_from_bible_plan(request: Request, plan_id: str):
    """Unsubscribe the current user from a Bible plan"""
    uid = request.state.uid
    
    deleted = await delete_user_bible_plan(uid, plan_id)

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    return {"success": True, "message": "Successfully unsubscribed from Bible plan"}


@auth_bible_plan_router.put("/progress/{plan_id}")
async def update_plan_progress(
    request: Request,
    plan_id: str,
    day: int = Body(...),
    completed_passages: List[str] = Body(...),
    is_completed: bool = Body(False)
):
    """Update progress for a specific day in a Bible plan"""
    uid = request.state.uid
    existing = await find_user_plan(uid, plan_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not subscribed to this plan")
    
    try:
        plan_object_id = ObjectId(plan_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Bible plan ID")

    plan_doc = await DB.db.bible_plans.find_one({"_id": plan_object_id})
    if not plan_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bible plan not found")

    progress = existing.get("progress", [])
    if day < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Day must be 1 or greater")

    readings_by_day = plan_doc.get("readings", {})
    plan_duration = plan_doc.get("duration", 0) or len(readings_by_day)

    allowed_day = _next_sequential_day(progress, readings_by_day, plan_duration)
    if day > allowed_day:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete previous days before updating this day",
        )

    day_progress_index = None
    for i, dp in enumerate(progress):
        if dp.get("day") == day:
            day_progress_index = i
            break
    
    new_progress = UserBiblePlanProgress(
        day=day,
        completed_passages=completed_passages,
        is_completed=is_completed
    )
    
    if day_progress_index is not None:
        # Update existing progress
        progress[day_progress_index] = new_progress.model_dump()
    else:
        # Add new progress
        progress.append(new_progress.model_dump())

    progress.sort(key=lambda entry: entry.get("day", 0))
    
    updated = await update_user_bible_plan_progress(uid, plan_id, progress)

    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update progress")
    
    return {"success": True, "message": "Progress updated successfully"}


@auth_bible_plan_router.put("/notification-settings/{plan_id}")
async def update_notification_settings(
    request: Request,
    plan_id: str,
    notification_time: Optional[str] = Body(None),
    notification_enabled: bool = Body(True)
):
    """Update notification settings for a Bible plan subscription"""
    uid = request.state.uid
    existing = await find_user_plan(uid, plan_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not subscribed to this plan")
    
    updated = await update_user_bible_plan_notifications(uid, plan_id, notification_time, notification_enabled)

    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update notification settings")
    
    return {"success": True, "message": "Notification settings updated successfully"}


@auth_bible_plan_router.post("/restart/{plan_id}")
async def restart_bible_plan(
    request: Request,
    plan_id: str,
    start_date: Optional[datetime] = Body(None, embed=True),
):
    """Reset progress for a Bible plan and optionally set a new start date"""
    uid = request.state.uid
    existing = await find_user_plan(uid, plan_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not subscribed to this plan")

    effective_start = start_date or datetime.now()
    restarted = await reset_user_bible_plan(uid, plan_id, effective_start)

    if not restarted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to restart Bible plan")

    return {
        "success": True,
        "message": "Bible plan restarted successfully",
        "start_date": effective_start,
    }
