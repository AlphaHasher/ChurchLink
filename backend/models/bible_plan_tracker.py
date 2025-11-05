from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from mongo.database import DB


class UserBiblePlanProgress(BaseModel):
    """Tracks progress for a single day in a Bible plan"""

    day: int
    completed_passages: List[str] = Field(default_factory=list)
    is_completed: bool = False


class UserBiblePlanSubscription(BaseModel):
    """User's subscription to a Bible plan"""

    plan_id: str
    start_date: datetime
    notification_time: Optional[str] = None
    notification_enabled: bool = True
    progress: List[UserBiblePlanProgress] = Field(default_factory=list)
    subscribed_at: datetime = Field(default_factory=datetime.now)


_COLLECTION_NAME = "bible_plan_tracker"


def _subscription_from_doc(doc: dict) -> UserBiblePlanSubscription:
    payload = {k: v for k, v in doc.items() if k in {
        "plan_id",
        "start_date",
        "notification_time",
        "notification_enabled",
        "progress",
        "subscribed_at",
    }}
    return UserBiblePlanSubscription(**payload)


async def get_user_bible_plans(uid: str) -> List[UserBiblePlanSubscription]:
    cursor = DB.db[_COLLECTION_NAME].find({"uid": uid}).sort("subscribed_at", -1)
    docs = await cursor.to_list(length=None)
    return [_subscription_from_doc(doc) for doc in docs]


async def insert_user_bible_plan(uid: str, subscription: UserBiblePlanSubscription) -> bool:
    doc = subscription.model_dump()
    doc["uid"] = uid
    result = await DB.db[_COLLECTION_NAME].insert_one(doc)
    return bool(result.inserted_id)


async def delete_user_bible_plan(uid: str, plan_id: str) -> bool:
    result = await DB.db[_COLLECTION_NAME].delete_one({"uid": uid, "plan_id": plan_id})
    return result.deleted_count > 0


async def update_user_bible_plan_progress(uid: str, plan_id: str, progress: List[dict]) -> bool:
    result = await DB.db[_COLLECTION_NAME].update_one(
        {"uid": uid, "plan_id": plan_id},
        {"$set": {"progress": progress}},
    )
    return result.matched_count > 0


async def update_user_bible_plan_notifications(
    uid: str,
    plan_id: str,
    notification_time: Optional[str],
    notification_enabled: bool,
    user_timezone: Optional[str] = None,
) -> bool:
    update_data = {
        "notification_time": notification_time,
        "notification_enabled": notification_enabled,
    }
    
    # Only update user_timezone if provided
    if user_timezone is not None:
        update_data["user_timezone"] = user_timezone
    
    result = await DB.db[_COLLECTION_NAME].update_one(
        {"uid": uid, "plan_id": plan_id},
        {"$set": update_data},
    )
    return result.modified_count > 0


async def reset_user_bible_plan(
    uid: str,
    plan_id: str,
    start_date: Optional[datetime] = None,
) -> bool:
    result = await DB.db[_COLLECTION_NAME].update_one(
        {"uid": uid, "plan_id": plan_id},
        {
            "$set": {
                "progress": [],
                "start_date": start_date or datetime.now(),
            }
        },
    )
    return result.matched_count > 0


async def find_user_plan(uid: str, plan_id: str) -> Optional[dict]:
    return await DB.db[_COLLECTION_NAME].find_one({"uid": uid, "plan_id": plan_id})
