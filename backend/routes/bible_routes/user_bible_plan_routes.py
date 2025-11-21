from fastapi import APIRouter, Request, HTTPException, status, Body
from typing import Any, Dict, List, Optional
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
import os

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
from models.bible_plan import _convert_plan_doc_to_out, ReadingPlanOut
from pydantic import BaseModel

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
    """
    Retrieve the current user's Bible plan subscriptions.
    
    Returns:
        List[UserBiblePlanSubscription]: The user's subscribed Bible plans.
    """
    uid = request.state.uid
    subscriptions = await get_user_bible_plans(uid)
    return subscriptions


class _UserPlanWithDetails(BaseModel):
    plan: ReadingPlanOut
    subscription: UserBiblePlanSubscription


@auth_bible_plan_router.get("/with-details", response_model=List[_UserPlanWithDetails])
async def get_my_bible_plans_with_details(request: Request) -> List[_UserPlanWithDetails]:
    """
    List the current user's subscribed Bible plans that are accessible to them, with each subscription paired with its plan details.
    
    Subscriptions with invalid plan IDs, missing plan documents, or other per-plan errors are skipped. A plan is included only if the requesting user is the plan owner or the plan is marked visible.
    
    Returns:
        List[_UserPlanWithDetails]: A list of objects combining the plan's output representation and the user's subscription data.
    """
    uid = request.state.uid
    subscriptions = await get_user_bible_plans(uid)

    results: List[_UserPlanWithDetails] = []
    for sub in subscriptions:
        try:
            try:
                plan_object_id = ObjectId(sub.plan_id)
            except InvalidId:
                # Skip invalid ids silently
                continue

            doc = await DB.db.bible_plans.find_one({"_id": plan_object_id})
            if not doc:
                # Skip missing plans silently
                continue

            # Allow if owner or visible (published)
            if doc.get("user_id") == uid or doc.get("visible", False):
                plan_out = _convert_plan_doc_to_out(doc)
                results.append(_UserPlanWithDetails(plan=plan_out, subscription=sub))
        except Exception:
            # Skip any problematic plan records without failing the whole list
            continue

    return results


@auth_bible_plan_router.post("/subscribe")
async def subscribe_to_bible_plan(
    request: Request,
    plan_id: str = Body(...),
    start_date: datetime = Body(...),
    notification_time: Optional[str] = Body(None),
    notification_enabled: bool = Body(True)
):
    """
    Subscribe the current authenticated user to a Bible reading plan.
    
    Validates the provided plan ID and published status, prevents duplicate subscriptions,
    creates a new subscription record with the provided start date and notification settings,
    and schedules notifications if a notification time is supplied.
    
    Parameters:
        plan_id (str): The string ID of the Bible plan to subscribe to.
        start_date (datetime): The date when the subscription should begin.
        notification_time (Optional[str]): Local time string for daily notifications (e.g., "08:00"), or None to disable scheduling.
        notification_enabled (bool): Whether notifications are enabled for this subscription.
    
    Returns:
        dict: {"success": True, "message": "Successfully subscribed to Bible plan"} on success.
    
    Raises:
        HTTPException: with status 400 if the plan_id is not a valid ObjectId.
        HTTPException: with status 404 if the plan does not exist or is not published.
        HTTPException: with status 409 if the user is already subscribed to the plan.
        HTTPException: with status 500 if creating the subscription (or persisting related updates) fails.
    """
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
    
    # Set user timezone to LOCAL_TIMEZONE for proper notification timing
    if notification_time:
        local_timezone = os.getenv('LOCAL_TIMEZONE', 'America/Los_Angeles')
        await update_user_bible_plan_notifications(uid, plan_id, notification_time, notification_enabled, local_timezone)

    return {"success": True, "message": "Successfully subscribed to Bible plan"}


@auth_bible_plan_router.delete("/unsubscribe/{plan_id}")
async def unsubscribe_from_bible_plan(request: Request, plan_id: str):
    """Unsubscribe the current user from a Bible plan"""
    uid = request.state.uid
    
    deleted = await delete_user_bible_plan(uid, plan_id)

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    return {"success": True, "message": "Successfully unsubscribed from Bible plan"}


@auth_bible_plan_router.put("/progress-batch/{plan_id}")
async def update_plan_progress_batch(
    request: Request,
    plan_id: str,
    day_updates: List[Dict[str, Any]] = Body(..., embed=True)
):
    """
    Apply multiple daily progress updates to the user's subscribed Bible plan.
    
    Validates each update entry, enforces the sequential update constraint, persists the combined progress list, and returns a success message on completion.
    
    Parameters:
        request (Request): FastAPI request with authenticated user in request.state.uid.
        plan_id (str): ID of the Bible plan to update.
        day_updates (List[Dict[str, Any]]): List of day update objects. Each object must include:
            - "day" (int): Day number (integer >= 1).
            - "completed_passages" (List[str], optional): List of completed passage identifiers.
            - "is_completed" (bool, optional): Whether the day is marked complete.
    
    Returns:
        dict: {"success": True, "message": "<human-readable message>"} on successful update.
    
    Raises:
        HTTPException: For authentication/subscription issues, invalid plan ID, missing plan,
                       invalid update payloads, attempts to update days beyond the allowed next day,
                       or internal persistence errors.
    """
    try:
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
        readings_by_day = plan_doc.get("readings", {})
        plan_duration = plan_doc.get("duration", 0) or len(readings_by_day)

        # Combine duplicate day updates so the last provided entry for a given day wins,
        # then process in ascending day order.
        combined_updates: Dict[int, Dict[str, Any]] = {}
        for upd in day_updates:
            day_val = upd.get("day")
            if not isinstance(day_val, int) or day_val < 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Each update must have a valid day (integer >= 1)"
                )
            combined_updates[day_val] = upd

        days_sorted = sorted(combined_updates.keys())

        progress_by_day = {entry.get("day"): i for i, entry in enumerate(progress)}
        applied_days: List[int] = []
        skipped_days: List[int] = []

        for day in days_sorted:
            update = combined_updates[day]

            allowed_day = _next_sequential_day(progress, readings_by_day, plan_duration)
            if day > allowed_day:
                skipped_days.append(day)
                continue

            completed_passages = update.get("completed_passages", [])
            if not isinstance(completed_passages, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="completed_passages must be a list of strings"
                )

            is_completed = update.get("is_completed", False)
            if not isinstance(is_completed, bool):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="is_completed must be a boolean"
                )

            new_progress = UserBiblePlanProgress(
                day=day,
                completed_passages=completed_passages,
                is_completed=is_completed
            )

            if day in progress_by_day:
                idx = progress_by_day[day]
                progress[idx] = new_progress.model_dump()
            else:
                progress.append(new_progress.model_dump())
                progress_by_day[day] = len(progress) - 1

            applied_days.append(day)

        progress.sort(key=lambda entry: entry.get("day", 0))
        
        updated = await update_user_bible_plan_progress(uid, plan_id, progress)

        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update progress")
        
        # Return details so clients can optionally reconcile if needed
        return {
            "success": True,
            "message": "Batch progress updated",
            "applied_days": applied_days,
            "skipped_days": skipped_days,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing batch update: {str(e)}"
        )


@auth_bible_plan_router.put("/notification-settings/{plan_id}")
async def update_notification_settings(
    request: Request,
    plan_id: str,
    notification_time: Optional[str] = Body(None),
    notification_enabled: bool = Body(True)
):
    """
    Update notification time and enablement for the current user's subscription to the specified reading plan.
    
    Uses the LOCAL_TIMEZONE environment variable (default "America/Los_Angeles") to interpret the provided notification_time.
    
    Parameters:
        plan_id (str): Identifier of the reading plan subscription to update.
        notification_time (Optional[str]): Local time string for daily notifications (e.g., "07:30"), or None to clear the time.
        notification_enabled (bool): Whether notifications should be enabled for the subscription.
    
    Returns:
        dict: {"success": True, "message": "Notification settings updated successfully"} on success.
    """
    uid = request.state.uid
    existing = await find_user_plan(uid, plan_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not subscribed to this plan")
    
    # Use LOCAL_TIMEZONE for proper notification timing
    local_timezone = os.getenv('LOCAL_TIMEZONE', 'America/Los_Angeles')
    updated = await update_user_bible_plan_notifications(uid, plan_id, notification_time, notification_enabled, local_timezone)

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