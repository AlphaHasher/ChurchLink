from __future__ import annotations

from typing import Literal, Optional, List, Dict, Annotated, Any
from datetime import datetime, timezone
from bson.objectid import ObjectId
from pydantic import BaseModel, Field
import logging

from mongo.database import DB
from helpers.MongoHelper import serialize_objectid_deep

# ------------------------------
# Models
# ------------------------------

class EventLocalization(BaseModel):
    title: str
    description: str
    location_info: str

class EventCore(BaseModel):
    """
    This is the class that defines the core of events.

    It includes specifically the minimal information that is common for the average person to read in an EventInstance AND an Admin to read in the Event admin panel
    """
    # A dictionary that has lang --> Localization info. Example: {"en":{"title":"An Event", "description":"A Riveting Description", "location_info":"The Spooky Haunted House across the Block"}}
    localizations: Dict[str, EventLocalization]
    # Event Context:
    # This is the origin date that all other events are based off of. If it is not a recurring event, it's the only date
    # If it is a recurring event, say, "weekly" it is the date that all other dates are based off. For instance, 3rd event in series with "Weekly" recurrence = origin_date + 2 weeks
    # EventInstance Context:
    # This is the date the event will physically take place on.
    date: datetime

    # Defines how often the event recurs, if ever. Follows pattern previously stated in origin_date for creating event instance dates
    recurring: Literal["daily", "weekly", "monthly", "yearly", "never"]

    # Event Context:
    # This is a bool that globally defines if registration is allowed for any of these particular events
    # If set to True, events will be conditionally able to be registered depending if occurence conditions are met
    # If set to False, events will be forbidden from being registered regardless.
    # Should be noted that event visibility and registration status are distinctly different.
    # EventInstance Context:
    # This is a simple bool that defines if registration is allowed or not for this particular event instance
    registration_allowed: bool

    # Event Context:
    # This is a boolean that will immediately hide all events regardless of status, if it is set to True, the user won't be able to find them
    # EventInstanceContext:
    # This is a boolean that will hide this particular instance from being fetched/shown
    hidden: bool

    # The datetime where registration is allowed to be opened
    # Optional: If no specification, it is assumed that registration is always open
    # Event Context:
    # If the event is a recurrence, the delta will be taken into account for opens and deadline
    # Take example of origin_date is December 25th, recurrence = Monthly, and registration_opens = December 15th
    # Next event in series will have date January 25th, with Registration opening January 15th
    # EventInstance Context:
    # Actual date for registration open of EventInstance
    registration_opens: Optional[datetime] = None

    # The datetime where registration is closed
    # Same logic and optionality as previous
    registration_deadline: Optional[datetime] = None

    # The datetime where a user who paid with paypal can no longer get an automatic refund
    # Same logic and optionality as previous
    automatic_refund_deadline: Optional[datetime] = None

    # A list of strings as ObjectID regarding the associated ministries for this event
    ministries: List[str]

    # Defines if only members are allowed to register for the event
    members_only: bool

    # Defines if RSVP is required for event
    rsvp_required: bool

    # Defines the maximum event spots available (occupancy)
    max_spots: Optional[Annotated[int, Field(gt=0)]]

    # Defines the price of the event
    price: Annotated[float, Field(ge=0.0)]

    # Defines optional age ranges for who is allowed to attend the event
    min_age: Optional[int] = None
    max_age: Optional[int] = None

    # Defines who is allowed to attend the event in regards to gender
    gender: Literal["all", "male", "female"]

    # Optional location_address, supposed to point to an Address accessible by maps so the user can find the event location on maps
    location_address: Optional[str] = None

    # image_id the object id of image_data that is attched to this event
    image_id: str

    # Payment processing fields
    # Note: keep string values but validate against the fixed set in do_event_validation
    payment_options: List[str] = Field(default_factory=list, description="Available payment methods: ['paypal', 'door']")

    # Optionally define a members only price
    member_price: Optional[Annotated[float, Field(ge=0.0)]] = None


class Event(EventCore):
    """
    This is the class that defines the origin structure of the event

    It is NOT an event instance, i.e. a representative of a physical event that takes place

    This is now its own model, EventInstance, and EventInstance has its own registration data

    Event is merely a blueprint that defines how EventInstance is constructed

    """
    # ObjectID of the event
    id: str
    # Defines how many recurrences are published/visible at a time. Defaults to 1 if no recurrences
    # If recurring is weekly and max_published is 3, for example, then the event for this week, next week, and the week after will be visible
    max_published: int
    # Defines if the events will continue to publish.
    # If a user wants to discontinue an event, but keep all events that have been already published ongoing, they can set this to False
    # The events will stop publishing in the future, but all current events will be allowed to play out as usual
    currently_publishing: bool
    # Define a list of object ID as str of discount codes applicable to this event
    discount_codes: List[str]
    # Datetime event was last updated on
    updated_on: datetime = Field(default_factory=datetime.now(timezone.utc))

    # ONLY for database purposes
    # Suppose that a user changes a recurrence or origin date, they will also be forced to choose a new origin date
    # But, we need to be able to still do our instance date = date + interval * (series-1) type math
    # Therefore, anchor_index will represent the series_index that a new origin date and occurrence interval begins for set of EventInstances
    # This will always be set to the first valid index of the new date creation methods
    anchor_index: int


class EventUpdate(BaseModel):
    """
    This is the class that defines how you can create and update events

    """
    # A dictionary that has lang --> Localization info. Example: {"en":{"title":"An Event", "description":"A Riveting Description", "location_info":"The Spooky Haunted House across the Block"}}
    localizations: Dict[str, EventLocalization]
    # This is the origin date that all other events are based off of. If it is not a recurring event, it's the only date
    # If it is a recurring event, say, "weekly" it is the date that all other dates are based off. For instance, 3rd event in series with "Weekly" recurrence = origin_date + 2 weeks
    date: datetime
    # Defines how often the event recurs, if ever. Follows pattern previously stated in origin_date for creating event instance dates
    recurring: Literal["daily", "weekly", "monthly", "yearly", "never"]
    # Defines how many recurrences are published/visible at a time. Defaults to 1 if no recurrences
    # If recurring is weekly and max_published is 3, for example, then the event for this week, next week, and the week after will be visible
    max_published: int
    # Defines if the events will continue to publish.
    # If a user wants to discontinue an event, but keep all events that have been already published ongoing, they can set this to False
    # The events will stop publishing in the future, but all current events will be allowed to play out as usual
    currently_publishing: bool
    # This is a boolean that will immediately hide all events regardless of status, if it is set to True, the user won't be able to find them
    hidden: bool
    # This is a bool that globally defines if registration is allowed for any of these particular events
    # If set to True, events will be conditionally able to be registered depending if occurence conditions are met
    # If set to False, events will be forbidden from being registered regardless.
    # Should be noted that event visibility and registration status are distinctly different.
    registration_allowed: bool
    # The datetime where registration is allowed to be opened
    # Optional: If no specification, it is assumed that registration is always open
    # If the event is a recurrence, the delta will be taken into account for opens and deadline
    # Take example of origin_date is December 25th, recurrence = Monthly, and registration_opens = December 15th
    # Next event in series will have date January 25th, with Registration opening January 15th
    registration_opens: Optional[datetime] = None
    # The datetime where registration is closed
    # Same logic and optionality as previous
    registration_deadline: Optional[datetime] = None
    # The datetime where a user who paid with paypal can no longer get an automatic refund
    # Same logic and optionality as previous
    automatic_refund_deadline: Optional[datetime] = None
    # A list of strings as ObjectID regarding the associated ministries for this event
    ministries: List[str]
    # Defines if only members are allowed to register for the event
    members_only: bool
    # Defines if RSVP is required for event
    rsvp_required: bool
    # Defines the maximum event spots available (occupancy)
    max_spots: Optional[Annotated[int, Field(gt=0)]]
    # Defines the price of the event
    price: Annotated[float, Field(ge=0.0)]
    # Optionally define a members only price
    member_price: Optional[Annotated[float, Field(ge=0.0)]] = None
    # Define a list of object ID as str of discount codes applicable to this event
    discount_codes: List[str]
    # Defines optional age ranges for who is allowed to attend the event
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    # Defines who is allowed to attend the event in regards to gender
    gender: Literal["all", "male", "female"]
    # Optional location_address, supposed to point to an address accessible by maps so the user can find the event location on maps
    location_address: Optional[str] = None
    # image_id the object id of image_data that is attched to this event
    image_id: str
    # Payment processing fields
    payment_options: List[str] = Field(default_factory=list, description="Available payment methods: ['paypal', 'door']")


class ReadModEvent(Event):
    """
    The Event info that gets displayed when getting events in admin panel

    Requires extra defaults for displays

    Just gets a default localization with default title + description + location_info

    Default data is defined by priorities:

    Highest - Check if language arg applied

    Then - Check if English localization

    Finally - Check first defined localization in dict
    """
    default_title: str
    default_description: str
    default_location_info: str
    default_localization: str


# ------------------------------
# Validation
# ------------------------------


def _coerce_to_aware_utc(dt_val):
    # Accept ISO-8601 strings (e.g., "2025-10-16T21:41:00Z" or with offsets)
    if isinstance(dt_val, str):
        # Handle trailing Z for UTC
        dt_val = dt_val.replace("Z", "+00:00")
        try:
            dt_val = datetime.fromisoformat(dt_val)
        except ValueError:
            return None, "Invalid date format; expected ISO-8601."

    if not isinstance(dt_val, datetime):
        return None, "Invalid date value; expected datetime or ISO-8601 string."

    # Make it timezone-aware in UTC
    if dt_val.tzinfo is None:
        dt_val = dt_val.replace(tzinfo=timezone.utc)

    else:
        dt_val = dt_val.astimezone(timezone.utc)

    return dt_val, None

def datetimes_equal_in_utc(a: datetime, b: datetime) -> bool:
    """
    Return True if `a` and `b` represent the exact same instant when compared in UTC.
    Naive datetimes are assumed to already be UTC.
    """
    aware_a, err_a = _coerce_to_aware_utc(a)
    if err_a:
        return False
    aware_b, err_b = _coerce_to_aware_utc(b)
    if err_b:
        return False
    return aware_a == aware_b

def validate_event_date_in_future(event_data, *, validate_date: bool = True):
    if not validate_date:
        return {'success': True, 'msg':'Date validation skipped...'}

    dt_val = event_data.get("date")
    event_dt_utc, err = _coerce_to_aware_utc(dt_val)
    if err:
        return {'success': False, 'msg': err}

    now_utc = datetime.now(timezone.utc)

    if event_dt_utc <= (now_utc):
        return {
            'success': False,
            'msg': "You must set the event date to take place after the current date and time."
        }

    return {'success': True}

def do_event_validation(event_data: dict, validate_date=True):
    """
    Has validation logic for event creation or update
    Takes the model_dump as an arg
    """
    try:
        # Validate payment options for paid events
        price = float(event_data.get("price", 0) or 0)
        payment_options = event_data.get("payment_options", []) or []
        if price > 0 and not payment_options:
            return {"success": False, "msg": "Events with price > 0 must have at least one payment option"}

        # Validate payment options are from the allowed set
        valid_options = {"paypal", "door"}
        for option in payment_options:
            if option not in valid_options:
                return {"success": False, "msg": f"Invalid payment option: {option}. Valid options are: {sorted(valid_options)}"}

        # Validate localizations if provided
        localizations = event_data.get("localizations")
        if localizations is not None:
            if not isinstance(localizations, dict) or len(localizations.values()) < 1:
                return {"success": False, "msg": "Error: At least one localization for event title/description is required!"}
            for lang, locale in localizations.items():
                title = (locale.get("title") or "").strip()
                description = (locale.get("description") or "").strip()
                if not title or not description:
                    return {"success": False, "msg": f"Error for localization {lang}: In each pre-set localization, a valid title and description must be set!"}

        # Optional: enforce future date
        result = validate_event_date_in_future(event_data, validate_date=validate_date)
        if not result["success"]:
            return result

        # Age checks (fixed parentheses)
        min_age = event_data.get("min_age")
        max_age = event_data.get("max_age")
        if min_age is not None and (min_age < 0 or min_age > 100):
            return {"success": False, "msg": "min_age must be between 0-100 (inclusive)"}
        if max_age is not None and (max_age < 0 or max_age > 100):
            return {"success": False, "msg": "max_age must be between 0-100 (inclusive)"}
        if min_age is not None and max_age is not None and min_age > max_age:
            return {"success": False, "msg": "min_age cannot be greater than max_age."}

        # Member price sanity
        member_price = event_data.get("member_price")
        if member_price is not None and price is not None and member_price > price:
            return {"success": False, "msg": "member_price cannot exceed price."}

        # Temporal ordering of registration windows
        date = event_data.get("date")
        if date:
            date, err = _coerce_to_aware_utc(date)
            if err:
                return {'success':False, 'msg':f'Error in reconciling event date! {err}'}
            event_data['date'] = date

        registration_opens = event_data.get("registration_opens")
        if registration_opens:
            registration_opens, err = _coerce_to_aware_utc(registration_opens)
            if err:
                return {'success':False, 'msg':f'Error in reconciling event registration opens date! {err}'}
            event_data['registration_opens'] = registration_opens

        registration_deadline = event_data.get("registration_deadline")
        if registration_deadline:
            registration_deadline, err = _coerce_to_aware_utc(registration_deadline)
            if err:
                return {'success':False, 'msg':f'Error in reconciling event registration deadline date! {err}'}
            event_data['registration_deadline'] = registration_deadline

        automatic_refund_deadline = event_data.get("automatic_refund_deadline")
        if automatic_refund_deadline:
            automatic_refund_deadline, err = _coerce_to_aware_utc(automatic_refund_deadline)
            if err:
                return {'success':False, 'msg':f'Error in reconciling event automatic refund date! {err}'}
            event_data['automatic_refund_deadline'] = automatic_refund_deadline

        if registration_opens and registration_deadline and registration_opens >= registration_deadline:
            return {"success": False, "msg": "The registration opening date must be before the registration deadline."}
        if date and registration_deadline and registration_deadline > date:
            return {"success": False, "msg": "The registration deadline must be on or before the event date."}
        if registration_opens and date and registration_opens > date:
            return {"success": False, "msg": "The registration opening date must be on or before the event date."}
        if automatic_refund_deadline:
            if automatic_refund_deadline > date:
                return {"success":False, "msg":"The automatic refund deadline must strictly be before the event date."}
            if registration_deadline and automatic_refund_deadline < registration_deadline:
                return {"success":False, "msg":"The automatic refund deadline must be on or after registration deadline!"}
            if registration_opens and automatic_refund_deadline <= registration_opens:
                return {"success":False, "msg":"The automatic refund deadline must after the registration opening date!"}
            
            if 'paypal' not in payment_options:
                return {"success":False, "msg":"An automatic refund deadline can only be added if PayPal is an allowed payment method. If the user paid at the door, there would never be an automatically processing refund upon cancellation."}
            if 'door' in payment_options:
                return {'success':False, 'msg':'An automatic refund deadline can only be added if there is no option to pay at the door. Reasoning: If this were allowed, it would create a situation where door-payers are allowed to cancel early, but PayPal payers are not.'}

        # max_spots
        max_spots = event_data.get("max_spots")
        if max_spots is not None and max_spots <= 0:
            return {"success": False, "msg": "max_spots must be > 0."}

        # Ministries shape
        ministries = event_data.get("ministries")
        if ministries is not None:
            if not isinstance(ministries, list) or any(not isinstance(x, str) for x in ministries):
                return {"success": False, "msg": "ministry must be a list of strings (ObjectId hex)."}

        # Valid max_published
        max_published = event_data.get("max_published", 1)
        if max_published < 1 or max_published > 798:
            return {"success": False, "msg": "Max events published has to be between 1 and 7 inclusive!"}

        # Validate that if an event is hidden it cant be registered for
        hidden = event_data.get("hidden")
        registration_allowed = event_data.get("registration_allowed")
        if hidden and registration_allowed:
            return {'success':False, 'msg':'An event cannot be hidden and allow registration!'}
        
        # Validate that event must have image
        image_id = event_data.get("image_id")
        if not image_id:
            return {'success':False, 'msg':'An event must have an image attached to it!'}
        
        # Validate that a location address exists
        address = event_data.get("location_address")
        if not address:
            return {'success':False, 'msg':'An event must have an address!'}

        return {"success": True, "msg": "Event input successfully validated."}
    except Exception as e:
        logging.exception("Unexpected validation error during do_event_validation")
        return {"success": False, "msg": f"Unexpected validation error: {e}"}


# ------------------------------
# CRUD Operations
# ------------------------------

async def create_event(event: EventUpdate) -> Optional[Event]:
    """
    Creates a new event using DB.insert_document.
    If event has price > 0, payment_options must contain at least one option.
    """
    try:
        # Validate Event
        event_data = event.model_dump()
        event_data['updated_on'] = datetime.now(timezone.utc)
        event_data['anchor_index'] = 1

        validation = do_event_validation(event_data)
        if validation['success'] is False:
            return {"success": False, "msg": validation['msg']}

        # Use the helper method to insert
        inserted_id = await DB.insert_document("events", event_data)
        if inserted_id is not None:
            # Fetch the created event to return it as EventOut
            event_data = await DB.db["events"].find_one({"_id": inserted_id})
            if event_data is not None:
                event_data["id"] = str(event_data.pop("_id"))
                # Ensure all ObjectIds are serialized to strings
                event_data = serialize_objectid_deep(event_data)
                return {"success": True, "msg":"Event succesfully created!", "event":Event(**event_data)}

        # Return None if insertion or fetching failed
        return None
    except Exception as e:
        logging.exception("An error occurred during event creation")
        return None



async def get_event_doc_by_id(event_id: str):
    """
    Retrieves an event document by its ID.
    (Uses find_one directly to target specific _id)
    """
    try:
        event_doc = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
        if event_doc is not None:
            return event_doc
        return None
    except Exception as e:
        logging.exception(f"Error fetching event by ID {event_id}")
        return None
    
async def get_event_by_id(event_id: str) -> Optional[Event]:
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
            return Event(**event_doc)
        return None
    except Exception as e:
        logging.exception(f"Error fetching event by ID {event_id}")
        return None
    
async def get_publishing_events() -> List[Event]:
    """
    Gets all events that are currently publishing new events as docs
    """
    try:
        cursor = DB.db["events"].find({"currently_publishing": True})
        docs: List[dict] = await cursor.to_list(length=None)
        return docs
    except Exception:
        logging.exception("Error fetching publishing events")
        return []


async def update_event(event_id: str, event: EventUpdate) -> Dict[str, Any]:
    """
    Updates an event by its ID.
    Implements Option 2: Any event with price > 0 requires payment.
    Uses PATCH semantics via EventUpdate (all fields optional).
    """
    try:
        # Convert to dict for processing
        event_data = event.model_dump()
        if not event_data:
            return {'success':False, 'msg':'Failed to dump event update to model!'}
        
        event_data['updated_on'] = datetime.now(timezone.utc)

        # Check 
        needs_date_validation = False
        old_event = await get_event_doc_by_id(event_id)
        if not old_event:
            return {'success':False, 'msg':'Could not find old event!'}


        if old_event.get("recurring") != event.recurring or not datetimes_equal_in_utc(event.date, old_event.get("date")):
            needs_date_validation = True

        # Validate Event (partial payload)
        validation = do_event_validation(event_data, needs_date_validation)
        if validation['success'] is False:
            return {'success':False, 'msg':validation['msg']}

        result = await DB.db["events"].update_one(
            {"_id": ObjectId(event_id)},
            {"$set": event_data},
        )
        if result.modified_count > 0:
            return {'success':True, 'msg':'Event update success!'}
        else:
            return {'success':False, 'msg':'Event update failed!: Failure on event update'}
    except Exception as e:
        logging.exception(f"Error updating event {event_id}")
        return {'success':False, 'msg':f'Error updating event! Exception {e}'}


async def delete_event(event_id: str) -> bool:
    """
    Deletes an event by its ID.
    (Uses delete_one directly to target specific _id)
    """
    try:
        result = await DB.db["events"].delete_one({"_id": ObjectId(event_id)})
        if result.deleted_count > 0:
            return {'success':True, 'msg':"Successfully deleted event!"}
        else:
            return {'success':False, 'msg':'Failed to delete event due to an unknown error!'}
    except Exception as e:
        logging.exception(f"Error deleting event {event_id}")
        return {'success':False, 'msg':f'Failed to delete event! Exception {e}'}
    

async def get_events_with_discount_code(
    code_id: str,
    preferred_lang: Optional[str] = None,
) -> List[ReadModEvent]:
    """
    Return ALL events whose `discount_codes` contains `code_id`, assembled as ReadModEvent.
    """
    try:
        # 1) Find matching events by discount code reference (stored as string IDs on Event)
        cursor = DB.db["events"].find({"discount_codes": code_id}, projection={"_id": 1})
        ids = [str(doc["_id"]) for doc in await cursor.to_list(length=None)]

        # 2) Assemble each to ReadModEvent using existing helper
        out: List[ReadModEvent] = []
        for eid in ids:
            ev = await get_readmod_event_by_id(eid, preferred_lang=preferred_lang)
            if ev:
                out.append(ev)
        return out
    except Exception:
        logging.exception("get_events_with_discount_code failed")
        return []
    
async def remove_discount_code_from_all_events(code_id: str) -> Dict[str, object]:
    """
    Pull the given discount code id (stored as str) from every event's discount_codes array.
    Returns {success, msg, modified_count}
    """
    try:
        result = await DB.db["events"].update_many(
            {"discount_codes": code_id},
            {"$pull": {"discount_codes": code_id}, "$set": {"updated_on": datetime.now(timezone.utc)}},
        )
        return {
            "success": True,
            "msg": f"Removed from {result.modified_count} event(s).",
            "modified_count": int(result.modified_count),
        }
    except Exception as e:
        logging.exception("Failed to pull discount code from events")
        return {"success": False, "msg": f"Failed to update events: {e}", "modified_count": 0}


# ------------------------------
# Powerful Search/Fetch
# ------------------------------

async def search_events(
    *,
    page: int = 1,
    limit: int = 20,
    query: Optional[str] = None,
    ministries: Optional[List[str]] = None,
    registration_allowed: Optional[bool] = None,
    hidden: Optional[bool] = None,
    members_only: Optional[bool] = None,
    rsvp_required: Optional[bool] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    gender: Optional[Literal["all", "male", "female"]] = None,
    preferred_lang: Optional[str] = None,  # used for BOTH default locale and search
    sort_by_date_asc: bool = True,
) -> Dict[str, Any]:
    """
    Powerful event search with pagination & filters.

    Search behavior:
    - Search is performed ONLY within the chosen default locale fields:
      `preferred_lang` -> "en" -> first defined locale (if any).
    - It checks `title` and `description` for a case-insensitive
      regex match of `query`.

    Filters:
    - ministries: at least one overlap
    - registration_allowed, hidden, members_only, rsvp_required: exact match when provided
    - gender: event.gender == 'all' or equals the requested gender
    - age overlap: event [min_age, max_age] intersects with requested [min_age, max_age],
      with missing event bounds treated as open-ended.
    """
    page = max(1, int(page))
    limit = max(1, min(int(limit), 200))
    skip = (page - 1) * limit

    base_match: Dict[str, Any] = {}

    if registration_allowed is not None:
        base_match["registration_allowed"] = registration_allowed
    if hidden is not None:
        base_match["hidden"] = hidden
    if members_only is not None:
        base_match["members_only"] = members_only
    if rsvp_required is not None:
        base_match["rsvp_required"] = rsvp_required

    if ministries:
        base_match["ministries"] = {"$in": ministries}

    # Gender: include 'all' as wildcard or exact gender match
    if gender is not None:
        base_match["$or"] = [{"gender": "all"}, {"gender": gender}]

    # Age overlap filter ($expr); only added when caller supplies at least one bound
    age_expr = None
    if min_age is not None or max_age is not None:
        req_min = min_age if min_age is not None else 0
        req_max = max_age if max_age is not None else 200
        age_expr = {
            "$expr": {
                "$and": [
                    {"$lte": [{"$ifNull": ["$min_age", 0]}, req_max]},
                    {"$gte": [{"$ifNull": ["$max_age", 200]}, req_min]},
                ]
            }
        }

    pipeline: List[Dict[str, Any]] = []

    if base_match:
        pipeline.append({"$match": base_match})
    if age_expr:
        pipeline.append({"$match": age_expr})

    # Compute the default locale key up-front:
    # preferred_lang -> "en" -> first available locale (if any).
    # Note: localizations may be an empty dict; guard for that.
    pipeline += [
        {
            "$addFields": {
                "_loc_kv": {"$objectToArray": {"$ifNull": ["$localizations", {}]}}
            }
        },
        {"$addFields": {"_locale_keys": {"$map": {"input": "$_loc_kv", "as": "p", "in": "$$p.k"}}}},
        {
            "$addFields": {
                "_has_keys": {"$gt": [{"$size": "$_locale_keys"}, 0]}
            }
        },
        {
            "$addFields": {
                "_default_key": {
                    "$cond": [
                        {
                            "$and": [
                                {"$ne": [preferred_lang, None]},
                                {"$in": [preferred_lang, "$_locale_keys"]},
                            ]
                        },
                        preferred_lang,
                        {
                            "$cond": [
                                {"$in": ["en", "$_locale_keys"]},
                                "en",
                                {
                                    "$cond": [
                                        {"$eq": ["$_has_keys", True]},
                                        {"$arrayElemAt": ["$_locale_keys", 0]},
                                        None,
                                    ]
                                },
                            ]
                        },
                    ]
                }
            }
        },
        # Instead of $getField (which rejects dynamic field paths on some Mongo versions),
        # pick the matching key from _loc_kv and extract its .v
        {
            "$addFields": {
                "_default_pair": {
                    "$first": {
                        "$filter": {
                            "input": "$_loc_kv",
                            "as": "p",
                            "cond": {"$eq": ["$$p.k", "$_default_key"]},
                        }
                    }
                }
            }
        },
        {
            "$addFields": {
                "_default_locale": {"$ifNull": ["$_default_pair.v", {}]}
            }
        },
    ]

    # Search ONLY within the chosen default locale's fields (title/description)
    if query:
        pipeline.append({
            "$match": {
                "$expr": {
                    "$or": [
                        {
                            "$regexMatch": {
                                "input": {"$ifNull": ["$_default_locale.title", ""]},
                                "regex": query,
                                "options": "i",
                            }
                        },
                        {
                            "$regexMatch": {
                                "input": {"$ifNull": ["$_default_locale.description", ""]},
                                "regex": query,
                                "options": "i",
                            }
                        },
                    ]
                }
            }
        })

    # Project ReadModEvent-compatible defaults and paginate
    pipeline += [
    {
        "$set": {
            "default_title": {"$ifNull": ["$_default_locale.title", ""]},
            "default_description": {"$ifNull": ["$_default_locale.description", ""]},
            "default_location_info": {"$ifNull": ["$_default_locale.location_info", ""]},
            "default_localization": {"$ifNull": ["$_default_key", ""]},
        }
    },
    {
        "$unset": [
            "_search_blob",
            "_loc_kv",
            "_locale_keys",
            "_has_keys",
            "_default_pair",
        ]
    },
    {"$sort": {"updated_on": 1 if sort_by_date_asc else -1}},
    {
        "$facet": {
            "data": [
                {"$skip": skip},
                {"$limit": limit},
                {"$addFields": {"id": {"$toString": "$_id"}}},
            ],
            "meta": [{"$count": "total"}],
        }
    },
]

    agg = await DB.db["events"].aggregate(pipeline).to_list(length=1)
    if not agg:
        return {"items": [], "page": page, "limit": limit, "total": 0, "pages": 0}

    facet = agg[0]
    data = facet.get("data", [])
    total = (facet.get("meta") or [{}])[0].get("total", 0)
    pages = (total + limit - 1) // limit if total else 0

    for d in data:
        d.pop("_id", None)

    items = [ReadModEvent(**serialize_objectid_deep(d)) for d in data]

    return {
        "items": items,  # List[ReadModEvent]
        "page": page,
        "limit": limit,
        "total": total,
        "pages": pages,
    }

# Simple fetch-by-id that returns a ReadModEvent with default localization resolved.
# preferred_lang -> "en" -> first available locale (if any).
async def get_readmod_event_by_id(
    event_id: str,
    preferred_lang: Optional[str] = None,
) -> Optional[ReadModEvent]:
    try:
        doc = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
        if not doc:
            return None

        # Resolve default localization key
        locs: Dict[str, Dict[str, Any]] = doc.get("localizations") or {}
        locale_keys = list(locs.keys())
        if preferred_lang and preferred_lang in locs:
            default_key = preferred_lang
        elif "en" in locs:
            default_key = "en"
        else:
            default_key = locale_keys[0] if locale_keys else None

        default_locale = locs.get(default_key or "", {}) or {}

        # Shape into ReadModEvent
        doc["id"] = str(doc.pop("_id"))
        doc = serialize_objectid_deep(doc)

        doc["default_title"] = (default_locale.get("title") or "")
        doc["default_description"] = (default_locale.get("description") or "")
        doc["default_location_info"] = (default_locale.get("location_info") or "")
        doc["default_localization"] = default_key or ""

        return ReadModEvent(**doc)
    except Exception:
        logging.exception(f"Error building ReadModEvent for id={event_id}")
        return None

