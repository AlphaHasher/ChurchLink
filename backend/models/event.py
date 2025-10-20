# Ministry selection
# Age Range
# Gender (Male/Female/Both)
# Free/Paid
# Search

from typing import Literal, Optional, List, Dict
from http.client import HTTPException
from typing import Literal, Optional, List
from datetime import datetime, time, timezone
from mongo.database import DB
from pydantic import BaseModel, Field
from bson.objectid import ObjectId
from helpers.MongoHelper import serialize_objectid_deep
import logging

class Event(BaseModel):
    id: str
    name: str
    ru_name: str
    description: str
    ru_description: str
    date: datetime
    location: str
    price: float
    spots: int
    rsvp: bool
    recurring: Literal["daily", "weekly", "monthly", "yearly", "never"]
    ministry: List[str]
    min_age: int = Field(default=1, ge=0)
    max_age: int = Field(default=100, ge=0)
    gender: Literal["all", "male", "female"]
    image_url: Optional[str] = None  # Add optional image URL
    roles: List[str]
    published: bool
    seats_taken: int = 0
    attendee_keys: List[str] = []
    attendees: List[Dict] = []
    # Payment processing fields
    payment_options: List[str] = Field(default=[], description="Available payment methods: ['paypal', 'door']")
    refund_policy: Optional[str] = Field(default=None, description="Event-specific refund policy")
    
    def requires_payment(self) -> bool:
        """Check if this event requires payment"""
        return self.price > 0 and len(self.payment_options) > 0
    
    def is_free_event(self) -> bool:
        """Check if this event is free"""
        return self.price == 0
    
    def has_paypal_option(self) -> bool:
        """Check if PayPal payment is available"""
        return 'paypal' in self.payment_options
    
    def has_door_payment_option(self) -> bool:
        """Check if pay-at-door option is available"""
        return 'door' in self.payment_options


class EventCreate(BaseModel):
    name: str
    ru_name: str
    description: str
    ru_description: str
    date: datetime
    location: str
    price: float
    spots: int
    rsvp: bool
    recurring: Literal["daily", "weekly", "monthly", "yearly", "never"]
    ministry: List[str]
    min_age: int = Field(default=1, ge=0)
    max_age: int = Field(default=100, ge=0)
    gender: Literal["all", "male", "female"]
    image_url: Optional[str] = None
    roles: List[str]
    published: bool
    seats_taken: Optional[int] = 0
    attendee_keys: Optional[List[str]] = []
    attendees: Optional[List[Dict]] = []
    # Payment processing fields
    payment_options: Optional[List[str]] = Field(default=[], description="Available payment methods: ['paypal', 'door']")
    refund_policy: Optional[str] = Field(default=None, description="Event-specific refund policy")


class EventOut(Event):
    id: str
    roles: List[str]


# CRUD Operations
async def create_event(event: EventCreate) -> Optional[EventOut]:
    """
    Creates a new event using DB.insert_document.
    If event has price > 0, payment_options must contain at least one option.
    """
    try:
        # Convert to dict for processing
        event_data = event.model_dump()
        
        # Validate payment options for paid events
        price = event_data.get("price", 0)
        payment_options = event_data.get("payment_options", [])
        
        if price > 0 and not payment_options:
            raise ValueError("Events with price > 0 must have at least one payment option")
        
        # Validate payment options contain only valid values
        valid_options = ['paypal', 'door']
        for option in payment_options:
            if option not in valid_options:
                raise ValueError(f"Invalid payment option: {option}. Valid options are: {valid_options}")
        
        # Use the helper method to insert
        inserted_id = await DB.insert_document("events", event_data)
        if inserted_id is not None:
            # Fetch the created event to return it as EventOut
            event_data = await DB.db["events"].find_one({"_id": inserted_id})
            if event_data is not None:
                event_data["id"] = str(event_data.pop("_id"))
                # Ensure all ObjectIds are serialized to strings
                event_data = serialize_objectid_deep(event_data)
                return EventOut(**event_data)
        # Return None if insertion or fetching failed
        return None
    except Exception as e:
        print(f"An error occurred during event creation: {e}")
        return None


async def get_event_by_id(event_id: str) -> Optional[EventOut]:
    """
    Retrieves an event by its ID.
    (Uses find_one directly to target specific _id)
    """
    try:
        event_doc = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
        if event_doc is not None:
            event_doc["id"] = str(event_doc.pop("_id"))
            # Ensure all ObjectIds are serialized to strings
            event_doc = serialize_objectid_deep(event_doc)
            return EventOut(**event_doc)
        return None
    except Exception as e:
        print(f"Error fetching event by ID {event_id}: {e}")
        return None


async def update_event(event_id: str, event: EventCreate) -> bool:
    """
    Updates an event by its ID.
    Implements Option 2: Any event with price > 0 requires payment.
    """
    try:
        # Convert to dict for processing
        event_data = event.model_dump(exclude_unset=True)
        
        # Note: Payment options are now handled by the payment_options field
        # No automatic setting of payment fields needed
        
        result = await DB.db["events"].update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": event_data
            },  # exclude_unset for partial updates
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error updating event {event_id}: {e}")
        return False


async def delete_event(event_id: str) -> bool:
    """
    Deletes an event by its ID.
    (Uses delete_one directly to target specific _id)
    """
    try:
        result = await DB.db["events"].delete_one({"_id": ObjectId(event_id)})
        return result.deleted_count > 0
    except Exception as e:
        print(f"Error deleting event {event_id}: {e}")
        return False


async def delete_events(filter_query: dict) -> int:
    """
    Deletes multiple events matching the filter query using the DB.delete_documents helper.
    Returns the number of documents deleted.

    Args:
        filter_query (dict): The MongoDB filter query to select documents for deletion.

    Returns:
        int: The number of events deleted.
    """
    logging.info(
        f"Attempting to delete events with filter: {filter_query}"
    )  # Log the filter being used
    deleted_count = await DB.delete_documents("events", filter_query)
    logging.info(f"Deleted {deleted_count} events.")
    return deleted_count


##search and filter function with sane defaults
async def search_events(
    query_text: str,
    skip: int = 0,
    limit: int = 100,
    ministry: str = None,
    age: Optional[int] = None,
    gender: Literal["male", "female", "all"] = "all",
    is_free: Optional[bool] = None,
    sort: Literal["asc", "desc"] = "asc",
    sort_by: Literal[
        "date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"
    ] = "date",
):
    query = {"$text": {"$search": query_text}}

    # Apply filters
    if ministry:
        query["ministry"] = {"$in": [ministry]}
    
    age_filter = {}
    if age is not None:
        query["min_age"] = {"$lte": age}
        query["max_age"] = {"$gte": age}

    if gender != "all":
        query["gender"] = gender
    if is_free is not None:
        query["price"] = 0.0 if is_free else {"$gt": 0.0}

    # Get total count matching search and filters
    total = await DB.db["events"].count_documents(query)

    # Get events with sorting and pagination
    sort_direction = 1 if sort == "asc" else -1
    cursor = (
        DB.db["events"]
        .find(query)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(limit)
    )
    events = await cursor.to_list(length=limit)

    # Convert MongoDB documents to EventOut objects
    events_out = []
    for event in events:
        event["id"] = str(event.pop("_id"))
        # Ensure all ObjectIds are serialized to strings
        event = serialize_objectid_deep(event)
        events_out.append(EventOut(**event))
    return events_out


# sort and filter with limit no search
async def sort_events(
    skip: int = 0,
    limit: int = 100,
    ministry: str = None,
    age: Optional[int] = None,
    gender: Literal["male", "female", "all"] = "all",
    is_free: Optional[bool] = None,
    sort: Literal["asc", "desc"] = "asc",
    sort_by: Literal[
        "date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"
    ] = "date",
    name: Optional[str] = None,
    max_price: Optional[float] = None,
    date_after: Optional[datetime] = None,
    date_before: Optional[datetime] = None,
):
    """
    Get events with optional filters and sorting.

    Args:
        skip (int): Number of events to skip
        limit (int): Maximum number of events to return
        ministry (str): Filter by ministry (must be in the event's list)
        min_age (int): Filter by minimum attendee age
        max_age (int): Filter by maximum attendee age
        gender (str): Filter by gender
        is_free (bool): Filter by free status (price == 0)
        sort (str): Sort direction ("asc" or "desc")
        sort_by (str): Field to sort by

    Returns:
        list: List of events matching the filters
    """
    query = {}

    # Apply filters
    if ministry:
        query["ministry"] = {"$in": [ministry]}

    if age is not None:
        query["min_age"] = {"$lte": age}
        query["max_age"] = {"$gte": age}

    if gender and gender in ("male", "female"):
        query["gender"] = {"$in": ["all", gender]}

    if is_free is not None and is_free:
        # Only free events
        query["price"] = 0.0
    elif max_price is not None:
        # Paid events
        query["price"] = {"$lte": max_price}

    if name:
        query["name"] = {"$regex": name, "$options": "i"}  # Case-insensitive name search

    if date_after is not None:
        query.setdefault("date", {})
        query["date"]["$gte"] = datetime.combine(date_after, time.min)

    if date_before is not None:
        query.setdefault("date", {})
        query["date"]["$lte"] = datetime.combine(date_before, time.max)

    # Get events with sorting
    sort_direction = 1 if sort == "asc" else -1
    cursor = (
        DB.db["events"]
        .find(query)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(limit)
    )
    events = await cursor.to_list(length=limit)

    # Convert MongoDB documents to EventOut objects
    events_out = []
    for event in events:
        # Convert _id to id string first
        event["id"] = str(event.pop("_id"))
        # Then serialize any remaining ObjectIds in nested structures
        event_clean = serialize_objectid_deep(event)
        events_out.append(
            EventOut(**event_clean)
        )  # Create EventOut by unpacking the modified dict
    return events_out


##get event amount
async def get_event_amount() -> int:
    """Gets the total number of events in the collection."""
    try:
        # count_documents is a direct method, no specific helper for this
        count = await DB.db["events"].count_documents({})
        return count
    except Exception as e:
        logging.error(f"Error counting events: {e}")
        return 0


async def get_all_ministries():
    if DB.db is None:
        raise HTTPException(status_code=500, detail="Database not initialized.")
    try:
        ministries_cursor = DB.db["events"].aggregate([
            {"$unwind": {"path": "$ministry", "preserveNullAndEmptyArrays": False}},
            {"$group": {"_id": "$ministry"}},
            {"$sort": {"_id": 1}}
        ])
        ministries = await ministries_cursor.to_list(length=100)
        return [m["_id"] for m in ministries]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to fetch ministries", "reason": str(e)}
        )

def _attendee_key(uid: str, person_id: Optional[ObjectId], kind: str = "rsvp", scope: str = "series") -> str:
    # “kind” allows extension (e.g., "registration") while keeping uniqueness separate
    return f"{uid}|{str(person_id) if person_id else 'self'}|{kind}|{scope}"

def _attendee_doc(uid: str, person_id: Optional[ObjectId], display_name: Optional[str], kind: str = "rsvp", scope: str = "series", payment_status: Optional[str] = None) -> Dict:
    attendee_doc = {
        "key": _attendee_key(uid, person_id, kind, scope),
        "kind": kind,  # "rsvp" | "registration"
        "scope": scope,  # "series" | "occurrence"
        "user_uid": uid,
        "person_id": person_id,
        "display_name": display_name,
        "addedOn": datetime.now(),
    }
    
    # Add payment status if provided
    if payment_status:
        attendee_doc["payment_status"] = payment_status
    
    return attendee_doc

async def rsvp_add_person(
    event_id: str,
    uid: str,
    person_id: Optional[ObjectId] = None,
    display_name: Optional[str] = None,
    kind: str = "rsvp",
    scope: str = "series",
    payment_status: Optional[str] = None,
) -> tuple[bool, str]:
    """
    Add RSVP atomically. Only manages the event collection.
    Returns (success, reason) where reason explains why it failed if success is False.
    """
    ev_oid = ObjectId(event_id)
    key = _attendee_key(uid, person_id, kind, scope)
    attendee = _attendee_doc(uid, person_id, display_name, kind, scope, payment_status)


    logging.info(f"[RSVP_ADD] Debug info:")
    logging.info(f"  - Event ID: {event_id}")
    logging.info(f"  - User ID: {uid}")
    logging.info(f"  - Person ID: {person_id}")
    logging.info(f"  - Attendee Key: {key}")
    logging.info(f"  - Kind: {kind}")

    # First, let's check if the person is already registered
    existing_event = await DB.db["events"].find_one(
        {"_id": ev_oid},
        {"attendee_keys": 1, "seats_taken": 1, "spots": 1}
    )
    
    if not existing_event:
        return False, "Event not found"
    
    attendee_keys = existing_event.get('attendee_keys', [])
    seats_taken = existing_event.get('seats_taken', 0)
    total_spots = existing_event.get('spots', 0)
    key_exists = key in attendee_keys

    logging.info(f"[RSVP_ADD] Event check:")
    logging.info(f"  - Current attendee keys: {attendee_keys}")
    logging.info(f"  - Seats taken: {seats_taken}")
    logging.info(f"  - Total spots: {total_spots}")
    logging.info(f"  - Key already exists: {key_exists}")

    # Check specific failure conditions
    if key_exists:
        logging.info(f"[RSVP_ADD] Key already present, treating as idempotent success: {key}")
        return True, "already_registered"
    
    if total_spots > 0 and seats_taken >= total_spots:
        return False, "event_full"
    
    # Build the query conditions
    query_conditions = {
        "_id": ev_oid,
        "attendee_keys": {"$ne": key},
    }
    
    # Only add capacity constraint if event has limited spots
    if total_spots > 0:
        query_conditions["$expr"] = {"$lte": [{"$add": ["$seats_taken", 1]}, "$spots"]}
        logging.info(f"[RSVP_ADD] Adding capacity constraint for {total_spots} spots")
    else:
        logging.info(f"[RSVP_ADD] No capacity constraint (unlimited spots)")

    logging.info(f"[RSVP_ADD] Query conditions: {query_conditions}")

    result = await DB.db["events"].find_one_and_update(
        query_conditions,
        {
            "$inc": {"seats_taken": 1},
            "$addToSet": {"attendee_keys": key},
            "$push": {"attendees": attendee},
        },
        return_document=False,
    )
    
    success = result is not None
    logging.info(f"[RSVP_ADD] Database update result: {result}")
    logging.info(f"[RSVP_ADD] Success: {'SUCCESS' if success else 'FAILED'}")

    if not success:
        # If the update failed, let's check why with more detailed debugging
        logging.info(f"[RSVP_ADD] Update failed, investigating...")

        # Check if event exists
        event_check = await DB.db["events"].find_one({"_id": ev_oid}, {"_id": 1, "name": 1, "seats_taken": 1, "spots": 1})
        if not event_check:
            logging.warning(f"[RSVP_ADD] Event not found with ID: {ev_oid}")
            return False, "event_not_found"
        else:
            logging.info(f"[RSVP_ADD] Event exists: {event_check.get('name', 'No name')}, seats_taken: {event_check.get('seats_taken', 0)}, spots: {event_check.get('spots', 0)}")

        # Check if key already exists
        key_check = await DB.db["events"].find_one(
            {"_id": ev_oid, "attendee_keys": key}, 
            {"attendee_keys": 1}
        )
        if key_check:
            logging.info(f"[RSVP_ADD] Key already exists in attendee_keys: {key}")
            # If another concurrent request added the key between our
            # find_one_and_update attempt and this check, treat this as a
            # successful (idempotent) registration.
            return True, "already_registered"
        else:
            logging.info(f"[RSVP_ADD] Key does not exist in attendee_keys: {key}")

        # Check capacity constraint manually
        current_event = await DB.db["events"].find_one(
            {"_id": ev_oid}, 
            {"seats_taken": 1, "spots": 1}
        )
        if current_event:
            seats_taken = current_event.get("seats_taken", 0)
            spots = current_event.get("spots", 0)
            logging.info(f"[RSVP_ADD] Final capacity check - seats_taken: {seats_taken}, spots: {spots}")
            if spots > 0 and seats_taken >= spots:
                logging.warning(f"[RSVP_ADD] Event is full")
                return False, "event_full"
        
        # Try a simpler update to see if there's a validation error
        try:
            simple_test = await DB.db["events"].find_one_and_update(
                {"_id": ev_oid},
                {"$set": {"test_field": "test"}},
                return_document=False,
            )
            if simple_test:
                logging.info(f"[RSVP_ADD] Simple update works, issue is with query conditions")
                # Remove test field
                await DB.db["events"].update_one({"_id": ev_oid}, {"$unset": {"test_field": 1}})
            else:
                logging.warning(f"[RSVP_ADD] Simple update also fails, event may be locked or have other issues")
        except Exception as e:
            logging.error(f"[RSVP_ADD] Exception during simple test: {e}")

        logging.error(f"[RSVP_ADD] Unknown reason for update failure")
        return False, "update_failed"
    
    if success:
        return True, "success"
    else:
        return False, "unknown_error"

async def rsvp_remove_person(
    event_id: str,
    uid: str,
    person_id: Optional[ObjectId] = None,
    kind: str = "rsvp",
    scope: Optional[str] = None,
) -> bool:
    """
    Remove RSVP atomically. Only manages the event collection.
    If scope is None, removes all registrations for this person (both occurrence and series).
    If scope is specified, only removes that specific scope registration.
    """
    ev_oid = ObjectId(event_id)
    
    if scope is not None:
        # Remove specific scope registration
        key = _attendee_key(uid, person_id, kind, scope)
        
        try:
            result = await DB.db["events"].find_one_and_update(
                {"_id": ev_oid, "attendee_keys": key},
                {
                    "$inc": {"seats_taken": -1},
                    "$pull": {
                        "attendees": {"key": key},
                        "attendee_keys": key
                    },
                },
                return_document=False,
            )
            
            if result is None:
                # FALLBACK: Try the opposite scope if the requested one doesn't exist
                opposite_scope = 'occurrence' if scope == 'series' else 'series'
                fallback_key = _attendee_key(uid, person_id, kind, opposite_scope)
                
                result = await DB.db["events"].find_one_and_update(
                    {"_id": ev_oid, "attendee_keys": fallback_key},
                    {
                        "$inc": {"seats_taken": -1},
                        "$pull": {
                            "attendees": {"key": fallback_key},
                            "attendee_keys": fallback_key
                        },
                    },
                    return_document=False,
                )
            
            return result is not None
        except Exception as e:
            logging.error(f"Error in rsvp_remove_person: {e}")
            return False
    else:
        # Remove all registrations for this person (both scopes if they exist)
        try:
            # First, find how many registrations exist
            event = await DB.db["events"].find_one({"_id": ev_oid})
            if not event:
                return False
                
            # Count matching attendees
            user_key_prefix = f"{uid}|{str(person_id) if person_id else 'self'}|{kind}|"
            matching_keys = [k for k in event.get("attendee_keys", []) if k.startswith(user_key_prefix)]
            count_to_remove = len(matching_keys)
            
            if count_to_remove == 0:
                return False
                
            # Remove all matching registrations
            result = await DB.db["events"].update_one(
                {"_id": ev_oid},
                {
                    "$inc": {"seats_taken": -count_to_remove},
                    "$pull": {
                        "attendees": {"user_uid": uid, "person_id": person_id, "kind": kind},
                        "attendee_keys": {"$in": matching_keys}
                    },
                },
            )
            
            return result.modified_count > 0
        except Exception as e:
            logging.error(f"Error in rsvp_remove_person: {e}")
            return False

async def rsvp_add_many(event_id: str, uid: str, person_ids: List[Optional[ObjectId]], kind: str = "rsvp") -> List[Optional[ObjectId]]:
    added: List[Optional[ObjectId]] = []
    for pid in person_ids:
        ok = await rsvp_add_person(event_id, uid, pid, None, kind)
        if not ok:
            break
        added.append(pid)
    return added

async def rsvp_remove_many(event_id: str, uid: str, person_ids: List[Optional[ObjectId]], kind: str = "rsvp") -> List[Optional[ObjectId]]:
    removed: List[Optional[ObjectId]] = []
    for pid in person_ids:
        if await rsvp_remove_person(event_id, uid, pid, kind):
            removed.append(pid)
    return removed

async def rsvp_list(event_id: str) -> Dict:
    ev = await DB.db["events"].find_one(
        {"_id": ObjectId(event_id)}, {"attendees": 1, "seats_taken": 1, "spots": 1}
    )
    
    if not ev:
        return {"attendees": [], "seats_taken": 0, "spots": 0}
    
    # Serialize ObjectIds in attendees
    attendees = ev.get("attendees", [])
    serialized_attendees = []
    
    for attendee in attendees:
        serialized = attendee.copy()
        if 'person_id' in serialized and isinstance(serialized['person_id'], ObjectId):
            serialized['person_id'] = str(serialized['person_id'])
        if '_id' in serialized and isinstance(serialized['_id'], ObjectId):
            serialized['_id'] = str(serialized['_id'])
        # Convert any other ObjectId fields that might exist
        for key, value in serialized.items():
            if isinstance(value, ObjectId):
                serialized[key] = str(value)
        serialized_attendees.append(serialized)
    
    return {
        "attendees": serialized_attendees,
        "seats_taken": ev.get("seats_taken", 0),
        "spots": ev.get("spots", 0)
    }


async def get_event_registrations_by_payment_status(event_id: str, payment_status: Optional[str] = None) -> List[Dict]:
    """Get event registrations filtered by payment status"""
    try:
        event = await DB.db["events"].find_one({"_id": ObjectId(event_id)}, {"attendees": 1})
        if not event:
            return []
        
        attendees = event.get("attendees", [])
        
        # Convert ObjectIds to strings for JSON serialization
        def serialize_attendee(attendee):
            serialized = attendee.copy()
            if 'person_id' in serialized and isinstance(serialized['person_id'], ObjectId):
                serialized['person_id'] = str(serialized['person_id'])
            if '_id' in serialized and isinstance(serialized['_id'], ObjectId):
                serialized['_id'] = str(serialized['_id'])
            # Convert any other ObjectId fields that might exist
            for key, value in serialized.items():
                if isinstance(value, ObjectId):
                    serialized[key] = str(value)
            return serialized
        
        if payment_status:
            # Filter by specific payment status and serialize
            filtered_attendees = [
                serialize_attendee(attendee) for attendee in attendees 
                if attendee.get("payment_status") == payment_status
            ]
            return filtered_attendees
        else:
            # Return all attendees with serialization
            return [serialize_attendee(attendee) for attendee in attendees]
            
    except Exception as e:
        logging.error(f"Error getting event registrations by payment status: {e}")
        return []


async def get_event_payment_summary(event_id: str) -> Dict:
    """Get payment summary for an event including counts by status"""
    try:
        event = await DB.db["events"].find_one({"_id": ObjectId(event_id)}, {"attendees": 1})
        if not event:
            return {
                "total_registrations": 0,
                "paid_count": 0,
                "pending_count": 0,
                "not_required_count": 0,
                "failed_count": 0,
                "by_status": {}
            }
        
        attendees = event.get("attendees", [])
        
        # Helper function to serialize ObjectIds
        def serialize_attendee(attendee):
            serialized = attendee.copy()
            if 'person_id' in serialized and isinstance(serialized['person_id'], ObjectId):
                serialized['person_id'] = str(serialized['person_id'])
            if '_id' in serialized and isinstance(serialized['_id'], ObjectId):
                serialized['_id'] = str(serialized['_id'])
            # Convert any other ObjectId fields that might exist
            for key, value in serialized.items():
                if isinstance(value, ObjectId):
                    serialized[key] = str(value)
            return serialized
        
        # Count by payment status
        status_counts = {}
        for attendee in attendees:
            status = attendee.get("payment_status", "not_required")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Create detailed breakdown with serialized attendees
        by_status = {}
        for status, count in status_counts.items():
            by_status[status] = {
                "count": count,
                "attendees": [
                    serialize_attendee(attendee) for attendee in attendees 
                    if attendee.get("payment_status") == status
                ]
            }
        
        return {
            "total_registrations": len(attendees),
            "paid_count": status_counts.get("completed", 0),
            "pending_count": status_counts.get("pending", 0),
            "not_required_count": status_counts.get("not_required", 0),
            "failed_count": status_counts.get("failed", 0),
            "by_status": by_status
        }
        
    except Exception as e:
        logging.error(f"Error getting event payment summary: {e}")
        return {
            "total_registrations": 0,
            "paid_count": 0,
            "pending_count": 0,
            "not_required_count": 0,
            "failed_count": 0,
            "by_status": {}
        }


async def update_attendee_payment_status(event_id: str, attendee_key: str, payment_status: str, transaction_id: Optional[str] = None) -> bool:
    """Update payment status for a specific attendee"""
    try:
        update_data = {"attendees.$.payment_status": payment_status}
        if transaction_id:
            update_data["attendees.$.transaction_id"] = transaction_id
        
        result = await DB.db["events"].update_one(
            {
                "_id": ObjectId(event_id),
                "attendees.key": attendee_key
            },
            {
                "$set": update_data
            }
        )
        
        return result.modified_count > 0
        
    except Exception as e:
        logging.error(f"Error updating attendee payment status: {e}")
        return False