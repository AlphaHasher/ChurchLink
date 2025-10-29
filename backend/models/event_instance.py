from typing import Literal, Optional, List, Dict, Any, Tuple
from datetime import datetime, time, timezone, timedelta
from pydantic import BaseModel, Field
from bson.objectid import ObjectId
import logging
import asyncio
from models.event import EventCore, EventLocalization
from mongo.database import DB
import calendar

# Overrides are grouped in a particular way.
# How it works is that if an override in any of the individual lists are set, all of the overrides in the list will be set
# In other words, if you change "gender" as an override, the min_age and max_age you set for overrides must also be set.
override_group_1 = ['localizations']
override_group_2 = ['location_url']
override_group_3 = ['image_id']
override_group_4 = ['date']
override_group_5 = ['rsvp_required', 'registration_opens', 'registration_deadline', 'max_spots', 'price', 'member_price', 'payment_options', 'refund_policy']
override_group_6 = ['members_only', 'gender', 'min_age', 'max_age']
override_group_7 = ['registration_allowed', 'hidden']
override_groups = [override_group_1, override_group_2, override_group_3, override_group_4, override_group_5, override_group_6, override_group_7]

allowed_overrides = []
for group in override_groups:
    for override in group:
        allowed_overrides.append(override)

class RegistrationDetails(BaseModel):
    """
    Contains details regarding how a user has registered
    """
    # Boolean that denotates whether the user themself has signed up for an event
    self_registered: bool
    # List of strings of objectID of their family members that have signed up for a particular event
    family_registered: List[str]

class EventInstanceOverrides(BaseModel):
    """
    This is a class that defines the overrides to apply to EventInstances to differ from the Event Blueprint
    """
    localizations: Optional[Dict[str, EventLocalization]] = None
    date: Optional[datetime] = None
    hidden: Optional[bool] = None
    registration_allowed: Optional[bool] = None
    registration_opens: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    members_only: Optional[bool] = None
    rsvp_required: Optional[bool] = None
    max_spots: Optional[int] = None
    price: Optional[float] = None
    member_price: Optional[float] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    gender: Optional[Literal["all", "male", "female"]] = None
    location_url: Optional[str] = None
    image_id: Optional[str] = None
    payment_options: Optional[List[Literal['paypal', 'door']]] = None
    refund_policy: Optional[str] = Field(default=None, description="Event-specific refund policy")



class EventInstance(BaseModel):
    """
    The particular data stored in Database as EventInstance

    """
    # Standard ObjectID
    id: str
    # ObjectID for parent "Event" that created this instance
    event_id: str
    # Series Index represents which occurence of the event it is (Starts at 1). Series Index 4 represents the 4th occurence of the event
    series_index: int
    # Overrides represents a deviation from the standard event factory
    # I.e. if an admin goes into the admin panel, they could change the location of a SPECIFIC instance instead of broadly throughout the event.
    overrides: EventInstanceOverrides
    # Overrides Tracker is a list of bools that checks if each group of overrides is active or not
    overrides_tracker: List[bool]
    # Seats filled represents the number of people that have signed up for the event
    seats_filled: int
    # Registration details
    # It works as a dict that works such that key --> value = str of user ID --> Registration Details
    # Registration details has self_registered as a boolean and family_registered as a list of strings of object id
    registration_details: Dict[str, RegistrationDetails]
    # target_date is stored in the backend and continually updated for easy indexing
    # Represents the "expected date" that this event will take place on if there were no explicit overrides.
    target_date: datetime
    # scheduled_date is also stored in the backend and continually updated for easy indexing
    # If an event date is overrided, the scheduled_date will reflect that and update to become that overridden date.
    # This is used so we can easily fetch event instances in order of how upcoming they are.
    scheduled_date: datetime
    # We need to track when the overrides were updated on for the purposes of DST normalizing in frontend.
    # "Intent" at time of creation is what we use for UTC --> Local time purposes, so we need to know if the "Intender" passed the UTC time while under a DST offeset.
    overrides_date_updated_on: datetime



class AssembledEventInstance(EventCore):
    """
    Instead of pointing to event_id and tracking overrides, this class is used in case you need to "Assemble" an EventInstance locally complete with info on overrides
    Also can be fetched so admins can view from the admin panel
    Not what the user sees on events page.
    """
    # Standard ObjectID
    id: str
    # ObjectID for parent "Event" that created this instance
    event_id: str
    # Series Index represents which occurence of the event it is (Starts at 1). Series Index 4 represents the 4th occurence of the event
    series_index: int
    # Same with discount codes
    discount_codes: List[str]

    # Seats filled represents the number of people that have signed up for the event
    seats_filled: int

    # target_date is stored in the backend and continually updated for easy indexing
    # Represents the expected date that this event will take place on.
    target_date: datetime

    # We need to track when the overrides were updated on for the purposes of DST normalizing in frontend.
    # "Intent" at time of creation is what we use for UTC --> Local time purposes, so we need to know if the "Intender" passed the UTC time while under a DST offeset.
    overrides_date_updated_on: datetime

    # updated_on represents when the event was updated, not the instance
    updated_on: datetime

    # Registration details
    # It works as a dict that works such that key --> value = str of user ID --> Registration Details
    # Registration details has self_registered as a boolean and family_registered as a list of strings of object id
    registration_details: Dict[str, RegistrationDetails]

    # Default Localization information
    default_title: str
    default_description: str
    default_location_info: str
    default_localization: str



class ReadEventInstance(EventCore):
    """
    THIS is what the user will see for a particular event instance.
    Will require assembly
    Assembly should include resolving the price based on if the user is a member or not.
    """
    # Standard ObjectID
    id: str
    # ObjectID for parent "Event" that created this instance
    event_id: str
    # Series Index represents which occurence of the event it is (Starts at 1). Series Index 4 represents the 4th occurence of the event
    series_index: int

    # Seats filled represents the number of people that have signed up for the event
    seats_filled: int

    # Default Localization information
    default_title: str
    default_description: str
    default_location_info: str
    default_localization: str

    # We need to track when the overrides were updated on for the purposes of DST normalizing in frontend.
    # "Intent" at time of creation is what we use for UTC --> Local time purposes, so we need to know if the "Intender" passed the UTC time while under a DST offeset.
    overrides_date_updated_on: datetime

    # updated_on represents when the event was updated, not the instance
    updated_on: datetime

    # Optional Boolean to quickly determine if a user has any registration for a particular event
    has_registrations: Optional[bool]
    # Optional details of actual RegistrationDetails that a user has for a particular EventInstance 
    event_registrations: Optional[RegistrationDetails]
    # Optional boolean to quickly determine if this event instance is in the user's favorite events
    is_favorited: Optional[bool]






# ------------------------------
# Helper Functions
# ------------------------------

# Helper: Clamp to last valid day of month
# Used to correct mistakes, such as targeting a date that doesn't exist.
# Think "Feb 31st". This will help bump that down to the last day of the month.
# Takes the year and month as arguments as well to give you a new date.
def _clamped_replace(d: datetime, year: int, month: int) -> datetime:
    last_day = calendar.monthrange(year, month)[1]
    day = min(d.day, last_day)
    return d.replace(year=year, month=month, day=day)

# Helper: Add months with end-of-month safety
# Intelligently tracks year overflow, and makes sure we don't target a day that doesn't exist via
# Calling the helper above
def _add_months(d: datetime, months: int) -> datetime:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    return _clamped_replace(d, y, m)

# Helper: Add years with end-of-Feb safety (e.g., Feb 29 -> clamp)
# In this instance, the date will be safe in every instance except case Feb 29
# This is the only calendar date that changes throughout the year.
# Optimistically tries a simple year addition, and if failure, tries
def _add_years(d: datetime, years: int) -> datetime:
    y = d.year + years
    try:
        return d.replace(year=y)
    except ValueError:
        # Likely Feb 29 -> clamp to last valid day in Feb of target year
        return _clamped_replace(d, y, d.month)

# Gets a new date_time based on origin date (the original date), Series index (the # of event instance of the event), recurrence type, and anchoring index
async def get_new_datetime(origin_date: datetime, series_index: int, recurrence: str, anchor_index: int = 1):
    """
    Compute the datetime for the Nth occurrence (series_index) given a recurrence rule.

    Notes:
    - Preserves the original time-of-day and timezone (tzinfo) from origin_date.
    - For 'monthly' and 'yearly', if the target day doesn't exist (e.g., Feb 30),
      the date is clamped to the last valid day of that month/year (e.g., Feb 28/29).
    """

    # Series Index starts at 1 with first event
    # Anchor Index is the index that we are basing datetime off of (consider if date was re-set, it may not be index 1)
    # First event has the origin_date
    # Thus we can use datetime + delta * recurrence to get new date
    delta = series_index - anchor_index

    # If a developer calls function for first event in series, or tries to call for recurrence == never, just return origin_date
    if delta == 0 or recurrence == 'never':
        return origin_date

    if recurrence == "daily":
        # Simple logic
        # Return datetime + delta number of days
        return origin_date + timedelta(days=delta)

    if recurrence == "weekly":
        # Simple logic
        # Return datetime + 7*delta number of days
        return origin_date + timedelta(days=7 * delta)

    if recurrence == "monthly":
        # IMPORTANT: INTERESTING LOGIC HERE
        # SIMPLE MATH DOESNT WORK
        # How monthly works is that the event always occurs on the same "day"
        # This means events will be April 15th, May 15th, June 15th etc...
        # This means simple + 30*delta doesnt work
        # However, a check must be made. It is possible for there to be an impossible date.
        # Such as May 31st --> June 31st which doesn't exist
        # If such an impossible day occurs, bump the impossible date down to the last day of that month
        # E.g. maybe have to do Feb 28 instead of Feb 31
        return _add_months(origin_date, delta)

    if recurrence == "yearly":
        # Same logic as monthly
        # Works so that if datetime is on August 7th 2025 next events are
        # Aug 7 2026, Aug 7 2027, Aug 7 2028
        # requires same safeguard logic as monthly in case of leap years
        # Should be noted that the only safeguard necessary is in the case of leap years because days of the month don't change except for case Feb 29
        return _add_years(origin_date, delta)

    # Defensive: unknown recurrence — raise explicit error to make bugs obvious upstream
    raise ValueError(f"Unsupported recurrence type: {recurrence!r}")

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _preferred_locale_key(localizations: Dict[str, Any], preferred_lang: Optional[str]) -> str:
    if not localizations:
        return "en"
    if preferred_lang and preferred_lang in localizations:
        return preferred_lang
    if "en" in localizations:
        return "en"
    # fallback to first available
    return next(iter(localizations.keys()))

def _age_covers_expr_eff(qmin: Optional[int], qmax: Optional[int]) -> Dict[str, Any]:
    """
    Coverage semantics on effective fields:
      both: eff.min_age <= qmin (or null) AND eff.max_age >= qmax (or null)
      only min: eff.max_age >= qmin (or null)
      only max: eff.min_age <= qmax (or null)
    """
    ev_min = {"$ifNull": ["$eff.min_age", -10_000_000]}
    ev_max = {"$ifNull": ["$eff.max_age",  10_000_000]}
    if qmin is not None and qmax is not None:
        return {"$and": [{"$lte": [ev_min, qmin]}, {"$gte": [ev_max, qmax]}]}
    if qmin is not None:
        return {"$gte": [ev_max, qmin]}
    if qmax is not None:
        return {"$lte": [ev_min, qmax]}
    return {"$literal": True}

def _gender_match_expr_user_eff(query_gender: Optional[str]) -> Dict[str, Any]:
    """
    User semantics on effective gender:
      'all'         => eff.gender == 'all'
      'male'        => eff.gender in ['all','male']     (Men Allowed)
      'female'      => eff.gender in ['all','female']   (Women Allowed)
      'male_only'   => eff.gender == 'male'
      'female_only' => eff.gender == 'female'
      None          => no filter
    """
    g = {"$ifNull": ["$eff.gender", "all"]}
    if not query_gender:
        return {"$literal": True}
    if query_gender == "all":
        return {"$eq": [g, "all"]}
    if query_gender == "male_only":
        return {"$eq": [g, "male"]}
    if query_gender == "female_only":
        return {"$eq": [g, "female"]}
    if query_gender == "male":
        return {"$in": [g, ["all", "male"]]}
    if query_gender == "female":
        return {"$in": [g, ["all", "female"]]}
    return {"$literal": True}

def _apply_uid_registrations(instance_doc: Dict[str, Any], uid: Optional[str]) -> Tuple[bool, Optional[Any]]:
    if not uid:
        return False, None
    details = instance_doc.get("registration_details") or {}
    # Treat keys as user ids; support both int/uuid as strings to be safe
    key = str(uid)
    return (key in details), (details.get(key))

# ------------------------------
# Publishing Functions
# ------------------------------

async def push_all_event_instances():
    # First calls get_publishing_events() from events
    # Do loop for all publishing events, and send document to push_event_instances
    events_cursor = DB.db["events"].find({"currently_publishing": True})
    publishing_events = await events_cursor.to_list(length=None)

    inserted_total = 0
    for ev in publishing_events:
        inserted_total += await push_event_instances(ev)
    return {"success": True, "inserted": inserted_total, "events_considered": len(publishing_events)}

async def push_event_instances_by_event_id(event_id: str):
    # First gets event by id
    # If event is publishing, send document to push_event_instances
    try:
        ev = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
        if not ev:
            return {"success": False, "msg": "Event not found."}

        if not ev.get("currently_publishing", False):
            return {"success": True, "inserted": 0, "msg": "Event is not currently publishing."}

        inserted = await push_event_instances(ev)
        return {"success": True, "inserted": inserted}
    except Exception as e:
        logging.exception("push_event_instances_by_event_id failed")
        return {"success": False, "msg": f"Exception: {e}"}


async def push_event_instances(event_doc: dict):
    """
    Pushes future EventInstance docs to maintain the event's `max_published` window.

    Uses anchor_index-based math: delta = series_index - anchor_index.
    """
    try:
        instances = DB.db["event_instances"]
        event_id_str = str(event_doc["_id"])

        # Pull recurrence metadata up-front
        recurrence = event_doc.get("recurring")
        origin_date = event_doc.get("date")
        anchor_index = int(event_doc.get("anchor_index") or 1)

        # Non-recurring: ensure exactly one instance at origin date
        if recurrence == "never":
            existing_total = await instances.count_documents({"event_id": event_id_str})
            if existing_total > 0:
                return 0
            doc = {
                "event_id": event_id_str,
                "series_index": anchor_index,
                "overrides": {},
                "overrides_tracker": [False, False, False, False, False, False, False],
                "seats_filled": 0,
                "registration_details": {},
                "target_date": origin_date,
                "scheduled_date":origin_date,
                "overrides_date_updated_on": event_doc.get("updated_on")
            }
            await instances.insert_one(doc)
            return 1

        # Recurring: maintain rolling window of future instances
        # The first thing we need to do is get all the upcoming instances from the event we are publishing for
        upcoming = await get_upcoming_instances_from_event_id(event_id_str)

        # "Need" is just the number of events we need to publish
        # In order to get this, we take the max published as the amount of events we want to target publishing and subtract the number of upcoming events already published
        need = int(event_doc.get("max_published", 1)) - len(upcoming)

        # If need == 0, the amount of published events is already good
        # If need < 0, this implies that the user had max published x and then changed to y such that x > y and we still have excess. Not policy to prune these, so just return
        if need <= 0:
            return 0

        # Next series_index for the next event we publish = (max existing) + 1
        # Just naturally speaking, if series index of the last published is 7, we need to start inserting at index 8.
        last = await instances.find(
            {"event_id": event_id_str},
            projection={"series_index": 1},
        ).sort("series_index", -1).limit(1).to_list(length=1)
        next_index = (last[0]["series_index"] if last else 0) + 1

        # Start assembling docs to push/publish
        docs = []
        # For every needed document
        for i in range(need):
            # Compute the series index and the target date
            series_index = next_index + i
            target_date = await get_new_datetime(
                origin_date, series_index, recurrence, anchor_index=anchor_index
            )
            # Add a fresh document to the list
            docs.append({
                "event_id": event_id_str,
                "series_index": series_index,
                "overrides": {},
                "overrides_tracker": [False, False, False, False, False, False, False],
                "seats_filled": 0,
                "registration_details": {},
                "target_date": target_date,
                "scheduled_date":target_date,
                "overrides_date_updated_on": event_doc.get("updated_on")
            })

        # If we have documents to publish, simply publish them
        if not docs:
            return 0

        if len(docs) == 1:
            await instances.insert_one(docs[0])
        else:
            await instances.insert_many(docs)

        return len(docs)
    except Exception:
        logging.exception("push_event_instances failed")
        return 0
    

async def recalculate_published_dates(event_id: str):
    """
    Recalculate future EventInstance.target_date values after an Event's origin date and/or recurrence changes.

    Rules:
      - target_date: always recomputed.
      - scheduled_date: set to target_date if no date override; keep as-is if date override present.
      - overrides_date_updated_on: set to the Event.updated_on if no date override; keep as-is if date override present.
    """
    try:
        ev = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
        if not ev:
            return {"success": False, "msg": "Event not found."}

        origin_date = ev.get("date")
        recurrence = ev.get("recurring")
        current_anchor = int(ev.get("anchor_index") or 1)

        instances_coll = DB.db["event_instances"]
        now = datetime.now(timezone.utc)

        # Get the instances that take place in the future
        # This is because we only need to recalculate future dates, not dates that already happened
        future_instances = await instances_coll.find(
            {"event_id": str(ev["_id"]), "target_date": {"$gt": now}},
            projection={"_id": 1, "series_index": 1, "overrides_tracker": 1},
        ).sort("series_index", 1).to_list(length=None)

        # If no future instances, then nothing to update, still bump event.updated_on for consistency
        if not future_instances:
            new_event_updated_on = datetime.now(timezone.utc)
            await DB.db["events"].update_one(
                {"_id": ev["_id"]},
                {"$set": {"anchor_index": current_anchor, "updated_on": new_event_updated_on}},
            )
            return {"success": True, "updated_instances": 0, "anchor_index": current_anchor}

        # The new "anchor event" is the next future event to take place, so we need to recalibrate that
        new_anchor_index = int(future_instances[0]["series_index"])

        # We also need to modify the event updated_on time
        new_event_updated_on = datetime.now(timezone.utc)

        # Update the event's anchor and updated_on first (used below for overrides_date_updated_on)
        await DB.db["events"].update_one(
            {"_id": ev["_id"]},
            {"$set": {"anchor_index": new_anchor_index, "updated_on": new_event_updated_on}},
        )

        # Build per-document update coroutines
        update_coros = []
        for inst in future_instances:

            # Compute new target date
            si = int(inst["series_index"])
            new_target = await get_new_datetime(origin_date, si, recurrence, anchor_index=new_anchor_index)

            # Update target date
            update_doc = {"target_date": new_target}

            # Check if date is overriden
            tracker = list(inst.get("overrides_tracker") or [])
            has_date_override = (len(tracker) >= 4 and bool(tracker[3]))

            # If date does not have an override, it means that we want to ensure:
            # 1. Scheduled date is the target date and they are in sync
            # 2. That the overrides_date_updated_on is in sync with standard event updated on (Because this date effectively determines TZ of if DST during when it got set)
            if not has_date_override:
                update_doc["scheduled_date"] = new_target
                update_doc["overrides_date_updated_on"] = new_event_updated_on

            # Append the corountine
            update_coros.append(
                instances_coll.update_one({"_id": inst["_id"]}, {"$set": update_doc})
            )

        # Run updates; sum modified counts
        modified = 0
        if update_coros:
            results = await asyncio.gather(*update_coros, return_exceptions=False)
            for r in results:
                modified += getattr(r, "modified_count", 0)

        return {"success": True, "updated_instances": modified, "anchor_index": new_anchor_index}
    except Exception as e:
        logging.exception("recalculate_published_dates failed")
        return {"success": False, "msg": f"Exception: {e}"}
    
# ------------------------------
# Search & Assembly for Admin Instances
# ------------------------------

async def search_assembled_event_instances(
    event_id: str,
    page: int = 1,
    limit: int = 25,
    status: Literal["all", "upcoming", "passed"] = "all",
    sort_by_series_index_asc: bool = True,
    preferred_lang: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Server-side pagination for EventInstances assembled with their parent Event fields.

    Changes:
    - Status uses scheduled_date (not target_date)
    - Sorting is *only* by series_index (asc/desc)
    - 'date' on the assembled payload reflects scheduled_date
    - Registration windows re-derived from the scheduled_date
    """
    page = max(1, int(page))
    limit = max(1, min(int(limit), 200))
    skip = (page - 1) * limit

    instances_coll = DB.db["event_instances"]
    events_coll = DB.db["events"]

    event_oid = ObjectId(event_id)
    parent = await events_coll.find_one({"_id": event_oid})
    if not parent:
        return {"items": [], "page": page, "limit": limit, "total": 0, "pages": 0}

    filt: Dict[str, Any] = {"event_id": str(event_id)}
    now = datetime.now(timezone.utc)

    if status == "upcoming":
        filt["scheduled_date"] = {"$gte": now}
    elif status == "passed":
        filt["scheduled_date"] = {"$lt": now}

    total = await instances_coll.count_documents(filt)

    cursor = (
        instances_coll.find(filt)
        .sort("series_index", 1 if sort_by_series_index_asc else -1)
        .skip(skip)
        .limit(limit)
    )

    parent_date: Optional[datetime] = parent.get("date")
    parent_open: Optional[datetime] = parent.get("registration_opens")
    parent_deadline: Optional[datetime] = parent.get("registration_deadline")

    delta_open = (parent_open - parent_date) if (parent_open and parent_date) else None
    delta_deadline = (parent_deadline - parent_date) if (parent_deadline and parent_date) else None

    locs: Dict[str, Dict[str, Any]] = parent.get("localizations") or {}
    locale_keys = list(locs.keys())
    default_key: Optional[str] = None
    if preferred_lang and preferred_lang in locs:
        default_key = preferred_lang
    elif "en" in locs:
        default_key = "en"
    elif locale_keys:
        default_key = locale_keys[0]

    items: List[Dict[str, Any]] = []
    async for inst in cursor:
        assembled: Dict[str, Any] = {}

        for k in [
            "localizations",
            "recurring",
            "registration_allowed",
            "hidden",
            "members_only",
            "rsvp_required",
            "max_spots",
            "price",
            "min_age",
            "max_age",
            "gender",
            "location_url",
            "ministries",
            "image_id",
            "updated_on",
            "origin_date",
            "date",
        ]:
            if k in parent:
                assembled[k] = parent[k]

        # identifiers + dates
        assembled["id"] = str(inst.get("_id"))
        assembled["event_id"] = str(event_id)
        assembled["series_index"] = int(inst.get("series_index") or 0)
        assembled["overrides_tracker"] = list(inst.get("overrides_tracker"))
        target_date: datetime = inst.get("target_date")
        scheduled_date: datetime = inst.get("scheduled_date") or target_date
        assembled["target_date"] = target_date
        overrides_update: datetime = inst.get("overrides_date_updated_on") or parent['updated_on']
        assembled['overrides_date_updated_on'] = overrides_update

        # the concrete occurrence date for UI/validation snapshots
        assembled["date"] = scheduled_date

        # recompute registration windows off scheduled_date
        assembled["registration_opens"] = (scheduled_date + delta_open) if delta_open is not None else None
        assembled["registration_deadline"] = (scheduled_date + delta_deadline) if delta_deadline is not None else None

        if default_key and default_key in locs:
            dloc = locs[default_key] or {}
            assembled["default_title"] = dloc.get("title", "") or ""
            assembled["default_description"] = dloc.get("description", "") or ""
            assembled["default_location_info"] = dloc.get("location_info", "") or ""
            assembled["default_localization"] = default_key
        else:
            assembled["default_title"] = ""
            assembled["default_description"] = ""
            assembled["default_location_info"] = ""
            assembled["default_localization"] = ""

        overrides: Dict[str, Any] = inst.get("overrides") or {}
        if overrides:
            assembled.update(overrides)

        items.append(assembled)

    pages = (total + limit - 1) // limit if limit else 0
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": pages,
        "sort_by_series_index_asc": sort_by_series_index_asc,
        "status": status,
        "preferred_lang": preferred_lang,
    }


async def search_upcoming_event_instances_for_read(
    *,
    limit: int = 20,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    gender: Optional[str] = None, # Arguments can be 'all'|'male'|'female'|'male_only'|'female_only'|None
    ministries: Optional[List[str]] = None,
    unique_only: bool = False,
    uid: Optional[str] = None,
    preferred_lang: Optional[str] = "en",
    cursor_scheduled_date: Optional[datetime] = None,
    cursor_id: Optional[str] = None,
    favorites_event_ids: Optional[List[str]] = None, # User favorite events (if user is signed in)
    favorites_only: bool = False,
    members_only_only: bool = False,
    max_price: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Public-facing fetch for upcoming event instances.

    - Filters apply to EFFECTIVE fields (parent + overrides merged), including hidden.
    - Unique-only groups AFTER all filters so you get the earliest *matching* occurrence per event.
    - Annotates `is_favorited` when `favorites_event_ids` is provided (private route).
    """
    if limit <= 0:
        limit = 1
    now = _now_utc()

    match_base: Dict[str, Any] = {"scheduled_date": {"$gte": now}}
    if cursor_scheduled_date is not None:
        after = {
            "$or": [
                {"scheduled_date": {"$gt": cursor_scheduled_date}},
                {"$and": [
                    {"scheduled_date": cursor_scheduled_date},
                    {"_id": {"$gt": ObjectId(cursor_id)}} if cursor_id else {"_id": {"$exists": True}},
                ]},
            ]
        }
        match_base = {"$and": [match_base, after]}

    pipeline: List[Dict[str, Any]] = [
        {"$match": match_base},
        {"$addFields": {"event_oid": {"$toObjectId": "$event_id"}}},
        {
            "$lookup": {
                "from": "events",
                "localField": "event_oid",
                "foreignField": "_id",
                "as": "event_doc",
            }
        },
        {"$unwind": "$event_doc"},
        {"$replaceRoot": {"newRoot": {"$mergeObjects": ["$$ROOT", {"event": "$event_doc"}]}}},
        # Compute EFFECTIVE fields from parent + overrides (overrides win)
        {"$addFields": {
            "eff": {
                "hidden": {"$or": [
                    {"$eq": [{"$ifNull": ["$event.hidden", False]}, True]},
                    {"$eq": [{"$ifNull": ["$overrides.hidden", False]}, True]}
                ]},
                "gender": {"$ifNull": ["$overrides.gender", {"$ifNull": ["$event.gender", "all"]}]},
                "min_age": {"$ifNull": ["$overrides.min_age", "$event.min_age"]},
                "max_age": {"$ifNull": ["$overrides.max_age", "$event.max_age"]},
                "ministries": {"$ifNull": ["$overrides.ministries", {"$ifNull": ["$event.ministries", []]}]},
                "members_only": {"$ifNull": ["$overrides.members_only", {"$ifNull": ["$event.members_only", False]}]},
                "price": {"$ifNull": ["$overrides.price", {"$ifNull": ["$event.price", 0]}]},
            }
        }},
        # Exclude effectively hidden instances
        {"$match": {"eff.hidden": {"$ne": True}}},
        # Gender filter
        {"$match": {"$expr": _gender_match_expr_user_eff(gender)}},
        # Age coverage filter
        {"$match": {"$expr": _age_covers_expr_eff(min_age, max_age)}},
    ]

    # Ministries intersection (effective)
    if ministries:
        pipeline += [
            {"$match": {
                "$expr": {
                    "$gt": [
                        {"$size": {"$setIntersection": ["$eff.ministries", ministries]}},
                        0
                    ]
                }
            }}
        ]

    # favorites-only filter (on parent event_id)
    if favorites_only:
        favs = favorites_event_ids or []
        # If user asked for favorites-only but has no favorites, short-circuit to empty result
        if not favs:
            return {"items": [], "next_cursor": None}
        pipeline += [{"$match": {"event_id": {"$in": favs}}}]

    # members-only filter (effective)
    if members_only_only:
        pipeline += [{"$match": {"$expr": {"$eq": [{"$ifNull": ["$eff.members_only", False]}, True]}}}]

    # max price filter (effective price <= max_price). 0 (free) naturally passes.
    if max_price is not None:
        pipeline += [{"$match": {"$expr": {"$lte": [{"$ifNull": ["$eff.price", 0]}, float(max_price)]}}}]

    # Sorting and uniqueness (group AFTER all filters)
    if unique_only:
        pipeline += [
            {"$sort": {"scheduled_date": 1, "_id": 1}},
            {"$group": {"_id": "$event_id", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$sort": {"scheduled_date": 1, "_id": 1}},
        ]
    else:
        pipeline += [{"$sort": {"scheduled_date": 1, "_id": 1}}]

    # Page + 1 to compute next_cursor
    pipeline += [{"$limit": limit + 1}]

    cur = DB.db["event_instances"].aggregate(pipeline)
    rows = await cur.to_list(length=limit + 1)

    items: List[Dict[str, Any]] = []
    next_cursor: Optional[Dict[str, Any]] = None

    if len(rows) > limit:
        last = rows.pop()
        next_cursor = {
            "scheduled_date": last["scheduled_date"].isoformat(),
            "id": str(last["_id"]),
        }

    # Build a set for favorited checks (private route only)
    fav_set = set(favorites_event_ids or [])

    for doc in rows:
        event_doc = doc["event"]
        inst_overrides = doc.get("overrides") or {}
        scheduled_date = inst_overrides.get("date") or doc.get("scheduled_date") or doc.get("target_date")

        # 1) seed from parent Event (core fields)
        assembled: Dict[str, Any] = {}
        for k in [
            "localizations", "recurring", "registration_allowed", "hidden",
            "registration_opens", "registration_deadline", "ministries",
            "members_only", "rsvp_required", "max_spots", "price",
            "min_age", "max_age", "gender", "location_url", "image_id",
            "payment_options", "refund_policy", "member_price", "updated_on",
        ]:
            if k in event_doc:
                assembled[k] = event_doc[k]

        # 2) identifiers & instance
        assembled["id"] = str(doc["_id"])
        assembled["event_id"] = doc["event_id"]
        assembled["series_index"] = int(doc.get("series_index") or 0)
        assembled["seats_filled"] = int(doc.get("seats_filled") or 0)
        assembled["date"] = scheduled_date

        # 3) registration windows from deltas (unless instance provided)
        parent_date = event_doc.get("date")
        parent_open = event_doc.get("registration_opens")
        parent_deadline = event_doc.get("registration_deadline")
        delta_open = (parent_open - parent_date) if (parent_open and parent_date) else None
        delta_deadline = (parent_deadline - parent_date) if (parent_deadline and parent_date) else None
        assembled["registration_opens"] = (scheduled_date + delta_open) if delta_open is not None else None
        assembled["registration_deadline"] = (scheduled_date + delta_deadline) if delta_deadline is not None else None

        # 4) apply instance overrides
        for k in [
            "localizations","registration_allowed","hidden","members_only","rsvp_required",
            "max_spots","price","member_price","payment_options","refund_policy",
            "min_age","max_age","gender","location_url","image_id",
            "registration_opens","registration_deadline",
        ]:
            if k in inst_overrides and inst_overrides[k] is not None:
                assembled[k] = inst_overrides[k]

        # 5) localization defaults
        effective_localizations = assembled.get("localizations") or {}
        loc_key = _preferred_locale_key(effective_localizations, preferred_lang)
        loc = effective_localizations.get(loc_key, {}) or {}
        assembled["default_title"] = loc.get("title") or ""
        assembled["default_description"] = loc.get("description") or ""
        assembled["default_location_info"] = loc.get("location_info") or ""
        assembled["default_localization"] = loc_key

        # 6) timestamps
        assembled["overrides_date_updated_on"] = doc.get("overrides_date_updated_on") or event_doc.get("updated_on")
        assembled["updated_on"] = event_doc.get("updated_on")

        # 7) per-user registration flags
        has_regs, regs = _apply_uid_registrations(doc, uid)
        assembled["has_registrations"] = has_regs
        assembled["event_registrations"] = regs if has_regs else None

        # 8) favorited annotation (parent event_id)
        assembled["is_favorited"] = (assembled["event_id"] in fav_set) if fav_set else False

        # Final guard: never return effectively hidden
        if assembled.get("hidden") is True:
            continue

        items.append(ReadEventInstance(**assembled).model_dump())

    return {"items": items, "next_cursor": next_cursor}

# ------------------------------
# Other CRUD Operations
# ------------------------------

async def get_instance_by_event_and_series_index(event_id: str, series_index: int) -> Optional[Dict[str, Any]]:
    """
    Fetch a single event_instances document by (event_id, series_index).
    event_id on instances is stored as a string (ObjectId string).
    """
    try:
        key_str = str(ObjectId(event_id))
    except Exception:
        key_str = str(event_id)

    coll = DB.db["event_instances"]
    doc = await coll.find_one({"event_id": key_str, "series_index": int(series_index)})
    return doc


async def get_instances_from_event_id(id: str):
    collection = DB.db["event_instances"]

    # Normalize the incoming id to the canonical stored form
    # EventInstance reference is string, but the actual event has an ObjectID id.
    try:
        key_str = str(ObjectId(id))
    except Exception:
        key_str = str(id)

    cursor = collection.find({"event_id": key_str})
    docs = await cursor.to_list(length=None)

    return docs

async def get_upcoming_instances_from_event_id(id: str):

    collection = DB.db["event_instances"]

    try:
        key_str = str(ObjectId(id))
    except Exception:
        key_str = str(id)

    now = datetime.now()

    cursor = collection.find(
        {"event_id": key_str, "scheduled_date": {"$gt": now}}
    ).sort("scheduled_date", 1)

    docs = await cursor.to_list(length=None)
    return docs

async def delete_event_instances_from_event_id(event_id: str):
    """
    Delete all EventInstance documents for the given event_id (stored as string on instances).
    Returns: {"success": bool, "deleted": int} or {"success": False, "msg": str}
    """
    try:
        coll = DB.db["event_instances"]
        res = await coll.delete_many({"event_id": str(event_id)})
        return {"success": True, "deleted": getattr(res, "deleted_count", 0)}
    except Exception as e:
        logging.exception("delete_event_instances_from_event_id failed")
        return {"success": False, "msg": f"Exception: {e}"}

