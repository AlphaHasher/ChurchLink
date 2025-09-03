from datetime import datetime
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

NOTIFICATIONS_COLLECTION = "notifications"

async def schedule_notification(db: AsyncIOMotorDatabase, data: dict) -> str:
    """
    Schedule a notification to be sent at a future date/time.
    data should include: title, message, scheduled_time (ISO string), target (all/single), fcm_token (optional)
    """
    data["created_at"] = datetime.utcnow().isoformat()
    data["sent"] = False
    result = await db[NOTIFICATIONS_COLLECTION].insert_one(data)
    return str(result.inserted_id)

async def get_scheduled_notifications(db: AsyncIOMotorDatabase) -> List[dict]:
    """Return all notifications that are scheduled but not sent."""
    cursor = db[NOTIFICATIONS_COLLECTION].find({"sent": False})
    return await cursor.to_list(length=100)

async def remove_scheduled_notification(db: AsyncIOMotorDatabase, notification_id: str) -> bool:
    """Remove a scheduled notification by its ID."""
    result = await db[NOTIFICATIONS_COLLECTION].delete_one({"_id": ObjectId(notification_id)})
    return result.deleted_count > 0

async def get_due_notifications(db: AsyncIOMotorDatabase) -> List[dict]:
    """Return notifications whose scheduled_time <= now and not sent."""
    now = datetime.utcnow().isoformat()
    cursor = db[NOTIFICATIONS_COLLECTION].find({"scheduled_time": {"$lte": now}, "sent": False})
    return await cursor.to_list(length=100)

async def mark_as_sent(db: AsyncIOMotorDatabase, notification_id: str):
    await db[NOTIFICATIONS_COLLECTION].update_one({"_id": ObjectId(notification_id)}, {"$set": {"sent": True, "sent_at": datetime.utcnow().isoformat()}})

async def log_notification(db: AsyncIOMotorDatabase, title, message, platform, recipients, actionType=None, link=None, route=None):
    doc = {
        "title": title,
        "message": message,
        "platform": platform,  # "mobile" or "email"
        "recipients": recipients,  # list of user_ids or tokens
        "timestamp": datetime.utcnow(),
        "sent": True
    }
    if actionType:
        doc["actionType"] = actionType
    if link:
        doc["link"] = link
    if route:
        doc["route"] = route
    await db[NOTIFICATIONS_COLLECTION].insert_one(doc)

async def get_notification_history(db: AsyncIOMotorDatabase, limit=100):
    cursor = db[NOTIFICATIONS_COLLECTION].find({"sent": True}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)
