"""
Bible Plan Notification Routes

API endpoints for managing Bible plan notification preferences and sending notifications.
"""

from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel

from helpers.BiblePlanNotificationHelper import (
    BiblePlanNotificationManager,
    update_bible_plan_notification_preference,
    get_bible_plan_notification_stats,
)
from helpers.NotificationHelper import get_available_notification_preferences
from helpers.BiblePlanScheduler import manual_schedule_bible_notifications
from models.bible_plan_tracker import (
    update_user_bible_plan_notifications as update_plan_notifications,
)


# Request/Response models
class NotificationPreferenceRequest(BaseModel):
    enabled: bool


class DeviceNotificationPreferenceRequest(BaseModel):
    token: str
    enabled: bool


class SendNotificationRequest(BaseModel):
    plan_id: str
    message: Optional[str] = None


class NotificationTimeRequest(BaseModel):
    notification_time: Optional[str] = None
    notification_enabled: bool = True
    user_timezone: Optional[str] = None


# Router setup
bible_notification_router = APIRouter(
    prefix="/bible-plan-notifications", tags=["Bible Plan Notifications"]
)


@bible_notification_router.put("/user-preference/{plan_id}")
async def update_user_bible_plan_notifications(
    request: Request, plan_id: str, notification_request: NotificationTimeRequest
):
    """Update notification preferences for a specific Bible plan subscription"""
    uid = request.state.uid

    try:
        from models.bible_plan_tracker import find_user_plan

        subscription = await find_user_plan(uid, plan_id)
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bible plan subscription not found",
            )

        # Update the user's Bible plan notification settings
        # If values are the same, update_plan_notifications returns False but that's OK
        await update_plan_notifications(
            uid=uid,
            plan_id=plan_id,
            notification_time=notification_request.notification_time,
            notification_enabled=notification_request.notification_enabled,
            user_timezone=notification_request.user_timezone,
        )

        return {
            "success": True,
            "message": "Notification preferences updated successfully",
            "notification_time": notification_request.notification_time,
            "notification_enabled": notification_request.notification_enabled,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notification preferences: {str(e)}",
        )


@bible_notification_router.put("/device-preference")
async def update_device_bible_plan_preference(
    device_request: DeviceNotificationPreferenceRequest,
):
    """Update Bible plan notification preference for a specific device token"""
    try:
        result = await update_bible_plan_notification_preference(
            token=device_request.token, enabled=device_request.enabled
        )

        if not result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to update device preference"),
            )

        return {
            "success": True,
            "message": "Device notification preference updated successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device preference: {str(e)}",
        )


@bible_notification_router.get("/available-preferences")
async def get_notification_preferences():
    """Get all available notification preference types"""
    try:
        result = await get_available_notification_preferences()
        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification preferences: {str(e)}",
        )


@bible_notification_router.post("/send-immediate")
async def send_immediate_notification(
    request: Request, send_request: SendNotificationRequest
):
    """Send an immediate Bible plan notification to the current user"""
    uid = request.state.uid

    try:
        result = (
            await BiblePlanNotificationManager.send_immediate_bible_plan_notification(
                uid=uid,
                plan_id=send_request.plan_id,
                custom_message=send_request.message,
            )
        )

        if not result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to send notification"),
            )

        return {
            "success": True,
            "message": "Notification sent successfully",
            "result": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send notification: {str(e)}",
        )


@bible_notification_router.get("/stats")
async def get_notification_stats():
    """Get statistics about Bible plan notifications (admin endpoint)"""
    try:
        stats = await get_bible_plan_notification_stats()

        if "error" in stats:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=stats["error"]
            )

        return {"success": True, "stats": stats}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification stats: {str(e)}",
        )


@bible_notification_router.post("/manual-schedule")
async def trigger_manual_scheduling():
    """Manually trigger Bible plan notification scheduling (admin endpoint)"""
    try:
        result = await manual_schedule_bible_notifications()

        if not result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to schedule notifications"),
            )

        return {
            "success": True,
            "message": f"Successfully scheduled {result.get('scheduled_count', 0)} notifications",
            "scheduled_count": result.get("scheduled_count", 0),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule notifications: {str(e)}",
        )


# Add route to get user's current notification preferences for all their Bible plans
@bible_notification_router.get("/my-preferences")
async def get_my_notification_preferences(request: Request):
    """Get current user's notification preferences for all their Bible plan subscriptions"""
    uid = request.state.uid

    try:
        from models.bible_plan_tracker import get_user_bible_plans

        # Get all user's Bible plan subscriptions
        subscriptions = await get_user_bible_plans(uid)

        # Extract notification preferences
        preferences = []
        for subscription in subscriptions:
            preferences.append(
                {
                    "plan_id": subscription.plan_id,
                    "notification_enabled": subscription.notification_enabled,
                    "notification_time": subscription.notification_time,
                    "start_date": subscription.start_date,
                    "subscribed_at": subscription.subscribed_at,
                }
            )

        return {"success": True, "preferences": preferences}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification preferences: {str(e)}",
        )


# Device-specific notification preference management


@bible_notification_router.post("/device-preference")
async def update_device_bible_plan_preference(
    request: DeviceNotificationPreferenceRequest,
):
    """Update Bible plan notification preference for a specific device token"""
    try:
        result = await update_bible_plan_notification_preference(
            token=request.token, enabled=request.enabled
        )

        if result.get("success"):
            return {
                "success": True,
                "message": f"Bible plan notifications {'enabled' if request.enabled else 'disabled'} for device",
                "enabled": request.enabled,
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update device preference",
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device preference: {str(e)}",
        )


@bible_notification_router.get("/device-preference/{token}")
async def get_device_bible_plan_preference_endpoint(token: str):
    """Get Bible plan notification preference for a specific device token"""
    try:
        from helpers.BiblePlanNotificationHelper import get_device_bible_plan_preference

        result = await get_device_bible_plan_preference(token)

        if result.get("success"):
            return {
                "success": True,
                "token": token[:20] + "..." if len(token) > 20 else token,
                "bible_plan_reminders_enabled": result.get(
                    "bible_plan_reminders_enabled"
                ),
                "all_preferences": result.get("all_preferences", {}),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device token not found or failed to get preferences",
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device preference: {str(e)}",
        )


@bible_notification_router.get("/admin/all-device-preferences")
async def get_all_device_preferences_endpoint():
    """Get Bible plan notification preferences for all devices (admin endpoint)"""
    try:
        from helpers.BiblePlanNotificationHelper import (
            get_all_bible_plan_notification_preferences,
        )

        result = await get_all_bible_plan_notification_preferences()

        if result.get("success"):
            return result
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get device preferences",
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all device preferences: {str(e)}",
        )
