"""
Event Cleanup Scheduler

Background task that manages the lifecycle of events and refunds:
1. Unpublishes non-recurring events 1 day after their date
2. Removes occurrence-scope RSVPs from recurring events 1 day after each occurrence
3. Cleans up stale RESERVING refund requests

This module follows the same pattern as scheduled_notifications.py
"""

import asyncio
import logging
from datetime import datetime, timedelta
from bson import ObjectId

logger = logging.getLogger(__name__)


async def event_cleanup_loop(db):
    """
    Background task that runs continuously to clean up expired events and registrations.
    
    Runs every 1 hour to:
    - Unpublish non-recurring events 1 day after their date
    - Remove occurrence-scope RSVPs from recurring events after each occurrence passes
    
    Args:
        db: MongoDB database instance
    """
    logger.info("Event cleanup scheduler started")
    
    # Run every hour
    CHECK_INTERVAL = 3600  # 1 hour in seconds
    
    while True:
        try:
            logger.info("Running event cleanup check...")
            
            # Perform cleanup operations
            results = await _cleanup_expired_events(db)
            
            # Perform refund cleanup operations
            refund_results = await _cleanup_stale_refunds(db)
            
            unpublished = results.get('unpublished', 0)
            cleaned_recurring = results.get('cleaned_recurring', 0)
            total_rsvps_removed = results.get('total_rsvps_removed', 0)
            
            refund_completed = refund_results.get('completed', 0)
            refund_rolled_back = refund_results.get('rolled_back', 0)
            refund_failed = refund_results.get('failed', 0)
            
            # Log results if any operations were performed
            if unpublished > 0 or cleaned_recurring > 0 or refund_completed > 0 or refund_rolled_back > 0:
                logger.info(
                    f"Cleanup completed: "
                    f"{unpublished} events unpublished, "
                    f"{cleaned_recurring} recurring events processed, "
                    f"{total_rsvps_removed} occurrence RSVPs removed, "
                    f"{refund_completed} refunds completed, "
                    f"{refund_rolled_back} refunds rolled back"
                )
            else:
                logger.debug("Cleanup completed: no events or refunds required processing")
            
            # Sleep until next check
            await asyncio.sleep(CHECK_INTERVAL)
            
        except Exception as e:
            logger.error(f"Error in event cleanup loop: {e}", exc_info=True)
            # Continue running even if there's an error
            await asyncio.sleep(CHECK_INTERVAL)


async def _cleanup_expired_events(db) -> dict:
    """
    Find and process events that have passed their date + 1 day threshold.
    
    Returns:
        dict: Statistics about cleanup operations
            - unpublished: Number of non-recurring events unpublished
            - cleaned_recurring: Number of recurring events processed
            - total_rsvps_removed: Total occurrence RSVPs removed
    """
    now = datetime.utcnow()
    cutoff_date = now - timedelta(days=1)
    
    logger.debug(f"Checking for events with date before {cutoff_date.isoformat()}")
    
    stats = {
        'unpublished': 0,
        'cleaned_recurring': 0,
        'total_rsvps_removed': 0
    }
    
    try:
        # Find events that have passed + 1 day and haven't been fully processed
        query = {
            "date": {"$lt": cutoff_date},
            "published": True
        }
        
        events_cursor = db["events"].find(query)
        events = await events_cursor.to_list(length=None)
        
        logger.debug(f"Found {len(events)} events to evaluate for cleanup")
        
        for event in events:
            event_id = event["_id"]
            event_name = event.get("name", "Unknown")
            event_date = event.get("date")
            recurring = event.get("recurring", "never")
            cleanup_processed = event.get("cleanup_processed", False)
            last_cleanup_date = event.get("last_cleanup_date")
            
            # Non-recurring events: Unpublish once
            if recurring == "never":
                if not cleanup_processed:
                    success = await _unpublish_event(event_id, event_name)
                    if success:
                        stats['unpublished'] += 1
                        logger.info(f"Unpublished non-recurring event: {event_name} (ID: {event_id})")
                else:
                    logger.debug(f"Event already processed: {event_name} (ID: {event_id})")
            
            # Recurring events: Clean occurrence RSVPs each time
            else:
                # Only process if this date hasn't been cleaned yet
                if last_cleanup_date is None or last_cleanup_date < event_date:
                    removed_count = await _remove_occurrence_rsvps(
                        event_id, 
                        event_name, 
                        event_date
                    )
                    if removed_count > 0:
                        stats['cleaned_recurring'] += 1
                        stats['total_rsvps_removed'] += removed_count
                        logger.info(
                            f"Cleaned occurrence RSVPs from recurring event: {event_name} "
                            f"(ID: {event_id}, removed {removed_count} RSVPs)"
                        )
                else:
                    logger.debug(
                        f"Recurring event already cleaned for this date: {event_name} "
                        f"(ID: {event_id}, last_cleanup: {last_cleanup_date})"
                    )
        
        return stats
        
    except Exception as e:
        logger.error(f"Error in _cleanup_expired_events: {e}", exc_info=True)
        return stats


async def _unpublish_event(event_id: ObjectId, event_name: str) -> bool:
    """
    Unpublish a non-recurring event by setting published=false.
    
    Args:
        event_id: The ObjectId of the event
        event_name: The event name (for logging)
    
    Returns:
        bool: True if successfully unpublished, False otherwise
    """
    from mongo.database import DB
    
    try:
        result = await DB.db["events"].update_one(
            {"_id": event_id},
            {
                "$set": {
                    "published": False,
                    "cleanup_processed": True,
                    "unpublished_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"Successfully unpublished event: {event_name} (ID: {event_id})")
            return True
        else:
            logger.warning(
                f"Event not modified during unpublish: {event_name} (ID: {event_id})"
            )
            return False
            
    except Exception as e:
        logger.error(
            f"Error unpublishing event {event_name} (ID: {event_id}): {e}",
            exc_info=True
        )
        return False


async def _remove_occurrence_rsvps(
    event_id: ObjectId, 
    event_name: str, 
    event_date: datetime
) -> int:
    """
    Remove all occurrence-scope RSVPs from a recurring event.
    
    This function:
    1. Finds all attendees with scope="occurrence"
    2. Removes them from the attendees array
    3. Removes their keys from attendee_keys array
    4. Decrements seats_taken by the number removed
    5. Marks this cleanup with last_cleanup_date
    
    Args:
        event_id: The ObjectId of the event
        event_name: The event name (for logging)
        event_date: The occurrence date being cleaned
    
    Returns:
        int: Number of occurrence RSVPs removed
    """
    from mongo.database import DB
    
    try:
        # First, get the current event to count occurrence RSVPs
        event = await DB.db["events"].find_one({"_id": event_id})
        
        if not event:
            logger.warning(f"Event not found: {event_name} (ID: {event_id})")
            return 0
        
        # Count attendees with scope="occurrence"
        attendees = event.get("attendees", [])
        occurrence_attendees = [a for a in attendees if a.get("scope") == "occurrence"]
        removed_count = len(occurrence_attendees)
        
        if removed_count == 0:
            logger.debug(f"No occurrence RSVPs to remove from: {event_name} (ID: {event_id})")
            # Still mark as cleaned to prevent re-checking
            await DB.db["events"].update_one(
                {"_id": event_id},
                {"$set": {"last_cleanup_date": event_date}}
            )
            return 0
        
        # Extract keys of occurrence attendees to remove
        occurrence_keys = [a.get("key") for a in occurrence_attendees if a.get("key")]
        
        # Remove occurrence RSVPs and update seats_taken atomically
        result = await DB.db["events"].update_one(
            {"_id": event_id},
            {
                "$pull": {
                    "attendees": {"scope": "occurrence"},
                    "attendee_keys": {"$in": occurrence_keys}
                },
                "$inc": {"seats_taken": -removed_count},
                "$set": {"last_cleanup_date": event_date}
            }
        )
        
        if result.modified_count > 0:
            logger.info(
                f"Removed {removed_count} occurrence RSVPs from {event_name} "
                f"(ID: {event_id})"
            )
            
            # Also remove from user's my_events
            await _cleanup_user_my_events(event_id, occurrence_attendees)
            
            return removed_count
        else:
            logger.warning(
                f"No modifications made when removing occurrence RSVPs: "
                f"{event_name} (ID: {event_id})"
            )
            return 0
            
    except Exception as e:
        logger.error(
            f"Error removing occurrence RSVPs from {event_name} (ID: {event_id}): {e}",
            exc_info=True
        )
        return 0


async def _cleanup_user_my_events(event_id: ObjectId, removed_attendees: list) -> None:
    """
    Remove event references from users' my_events arrays for cleaned occurrence RSVPs.
    
    Args:
        event_id: The ObjectId of the event
        removed_attendees: List of attendee dicts that were removed
    """
    from mongo.database import DB
    
    try:
        # Build a list of user UIDs and person_ids that need cleanup
        cleanup_targets = []
        for attendee in removed_attendees:
            uid = attendee.get("user_uid")
            person_id = attendee.get("person_id")
            if uid:
                cleanup_targets.append({
                    "uid": uid,
                    "person_id": person_id,
                    "key": attendee.get("key")
                })
        
        if not cleanup_targets:
            return
        
        # Remove from each user's my_events
        for target in cleanup_targets:
            # Use the key for precise removal
            result = await DB.db["users"].update_one(
                {"uid": target["uid"]},
                {
                    "$pull": {
                        "my_events": {
                            "event_id": event_id,
                            "scope": "occurrence",
                            "person_id": target["person_id"]
                        }
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.debug(
                    f"Cleaned my_events for user {target['uid']} "
                    f"(person_id: {target['person_id']})"
                )
        
    except Exception as e:
        logger.error(f"Error cleaning up user my_events: {e}", exc_info=True)


async def _cleanup_stale_refunds(db) -> dict:
    """
    Wrapper function to call the refund cleanup from models.refund_request.
    
    Returns:
        dict: Statistics about refund cleanup operations
            - completed: Number of stale refunds completed
            - rolled_back: Number of stale refunds rolled back
            - failed: Number of cleanup operations that failed
    """
    try:
        # Import here to avoid circular imports
        from models.refund_request import cleanup_stale_reserving_refunds
        
        # Call the refund cleanup function with default 10-minute timeout
        results = await cleanup_stale_reserving_refunds(max_age_minutes=10)
        
        logger.debug(f"Refund cleanup results: {results}")
        return results
        
    except Exception as e:
        logger.error(f"Error in refund cleanup wrapper: {e}", exc_info=True)
        return {"completed": 0, "rolled_back": 0, "failed": 1}
