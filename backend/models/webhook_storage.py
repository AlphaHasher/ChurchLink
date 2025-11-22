from __future__ import annotations

from typing import Any, Dict
from datetime import datetime
from mongo.database import DB

EVENTS_SEEN_COLL = "webhook_events_seen"
EVENTS_FAIL_COLL = "webhook_failures"

async def record_event_seen(event_id: str, event: Dict[str, Any]) -> bool:
    """
    Returns True if we've seen this event before (duplicate).
    """
    if not event_id:
        return False
    res = await DB.db[EVENTS_SEEN_COLL].update_one(
        {"_id": event_id},
        {"$setOnInsert": {"_id": event_id, "first_seen_at": datetime.utcnow(), "event_type": event.get("event_type"), "event": event}},
        upsert=True,
    )
    # If matched_count is 1 and upserted_id is None, it existed already (duplicate)
    return res.matched_count == 1 and res.upserted_id is None

async def record_event_failure(event_id: str, reason: str, payload: Dict[str, Any]) -> None:
    await DB.db[EVENTS_FAIL_COLL].insert_one({
        "event_id": event_id,
        "reason": reason,
        "payload": payload,
        "at": datetime.utcnow(),
    })

