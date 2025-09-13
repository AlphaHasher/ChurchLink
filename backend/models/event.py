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


class EventOut(Event):
    id: str
    roles: List[str]


# CRUD Operations
async def create_event(event: EventCreate) -> Optional[EventOut]:
    """
    Creates a new event using DB.insert_document.
    """
    try:
        # Use the helper method to insert
        inserted_id = await DB.insert_document("events", event.model_dump())
        if inserted_id is not None:
            # Fetch the created event to return it as EventOut
            event_data = await DB.db["events"].find_one({"_id": inserted_id})
            if event_data is not None:
                event_data["id"] = str(event_data.pop("_id"))
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
            return EventOut(**event_doc)
        return None
    except Exception as e:
        print(f"Error fetching event by ID {event_id}: {e}")
        return None


async def update_event(event_id: str, event: EventCreate) -> bool:
    """
    Updates an event by its ID.
    (Uses update_one directly to target specific _id)
    """
    try:
        result = await DB.db["events"].update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": event.model_dump(exclude_unset=True)
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
    print(
        f"Attempting to delete events with filter: {filter_query}"
    )  # Log the filter being used
    deleted_count = await DB.delete_documents("events", filter_query)
    print(f"Deleted {deleted_count} events.")
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

    if gender is not None:
        query["gender"] = gender

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
        event["id"] = str(
            event.pop("_id")
        )  # Add 'id' field using the value from '_id', then remove '_id'
        events_out.append(
            EventOut(**event)
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
        print(f"Error counting events: {e}")
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
    
def _attendee_key(uid: str, person_id: Optional[ObjectId], kind: str = "rsvp") -> str:
    # “kind” allows extension (e.g., "registration") while keeping uniqueness separate
    return f"{uid}|{str(person_id) if person_id else 'self'}|{kind}"

def _attendee_doc(uid: str, person_id: Optional[ObjectId], display_name: Optional[str], kind: str = "rsvp") -> Dict:
    return {
        "key": _attendee_key(uid, person_id, kind),
        "kind": kind,  # "rsvp" | "registration"
        "user_uid": uid,
        "person_id": person_id,
        "display_name": display_name,
        "addedOn": datetime.now(),
    }

async def rsvp_add_person(
    event_id: str,
    uid: str,
    person_id: Optional[ObjectId] = None,
    display_name: Optional[str] = None,
    kind: str = "rsvp",
) -> bool:
    """
    Add RSVP atomically. Only manages the event collection.
    """
    ev_oid = ObjectId(event_id)
    key = _attendee_key(uid, person_id, kind)
    attendee = _attendee_doc(uid, person_id, display_name, kind)

    result = await DB.db["events"].find_one_and_update(
        {
            "_id": ev_oid,
            "attendee_keys": {"$ne": key},
            "$expr": {"$lte": [{"$add": ["$seats_taken", 1]}, "$spots"]},
        },
        {
            "$inc": {"seats_taken": 1},
            "$addToSet": {"attendee_keys": key},
            "$push": {"attendees": attendee},
        },
        return_document=False,
    )
    return result is not None

async def rsvp_remove_person(
    event_id: str,
    uid: str,
    person_id: Optional[ObjectId] = None,
    kind: str = "rsvp",
) -> bool:
    """
    Remove RSVP atomically. Only manages the event collection.
    """
    ev_oid = ObjectId(event_id)
    key = _attendee_key(uid, person_id, kind)

    result = await DB.db["events"].find_one_and_update(
        {"_id": ev_oid, "attendee_keys": key},
        {
            "$inc": {"seats_taken": -1},
            "$pull": {"attendees": {"key": key}},
            "$pull": {"attendee_keys": key},
        },
        return_document=False,
    )
    return result is not None

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
    return ev or {"attendees": [], "seats_taken": 0, "spots": 0}