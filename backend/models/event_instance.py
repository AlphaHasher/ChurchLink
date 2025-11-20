from typing import Literal, Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from bson.objectid import ObjectId
import logging
import asyncio
from models.event import EventCore, EventLocalization
from mongo.database import DB
import calendar


# Mutex used for event publishing safety
_PUBLISH_MUTEX = asyncio.Lock()

# Overrides are grouped in a particular way.
# How it works is that if an override in any of the individual lists are set, all of the overrides in the list will be set
# In other words, if you change "gender" as an override, the min_age and max_age you set for overrides must also be set.
override_group_1 = ['localizations']
override_group_2 = ['location_address']
override_group_3 = ['image_id']
override_group_4 = ['date', 'end_date']
override_group_5 = ['rsvp_required', 'registration_opens', 'registration_deadline', 'automatic_refund_deadline', 'max_spots', 'price', 'member_price', 'payment_options']
override_group_6 = ['members_only', 'gender', 'min_age', 'max_age']
override_group_7 = ['registration_allowed', 'hidden']
override_groups = [override_group_1, override_group_2, override_group_3, override_group_4, override_group_5, override_group_6, override_group_7]

# The list of overrides that are allowed to set a value to None, e.g. Max Age is allowed to be None.
overrides_allowed_none = ['end_date', 'registration_opens', 'registration_deadline', 'automatic_refund_deadline','max_spots', 'member_price', 'min_age', 'max_age']

allowed_overrides = []
for group in override_groups:
    for override in group:
        allowed_overrides.append(override)


# Small Class that allows you to determine who you would like to include in your registration change
class ChangeEventRegistration(BaseModel):
    # The event instance ID the user is signing up for
    event_instance_id: str
    # A bool that determines if user themselves is signing up:
    # True --> User is Registering
    # False --> User is Unregistering (Should already be registering)
    # None --> User status is not changing
    self_registered: Optional[bool]
    # List of family members that are NOT on the registration already but are being added
    family_members_registering: List[str]
    # List of family members that are ON the registration currently and are being unregistered
    family_members_unregistering: List[str]
    # Payment Type that is being requested for added users
    payment_type: Literal['free', 'paypal', 'door']
    # Optional discount code being applied on the transaction
    discount_code_id: Optional[str]

class PaymentDetails(BaseModel):
    """
    Contains details regarding how a user has paid
    """
    # Says what kind of payment the user signed up for
    # "free" if no payment
    payment_type: Literal['free', 'paypal', 'door']

    # What price the user signed up for (user-facing price)
    # May differ from event price, consider discounts or price changes
    price: float

    # For PayPal:
    #  - The maximum amount we will ever automatically refund for this line.
    #  - Typically = unit_price minus that line's share of the PayPal transaction fee.
    # For non-PayPal lines this can be None.
    refundable_amount: Optional[float] = None

    # Cumulative amount refunded against this payment line (in the same currency).
    # Increases with each refund (admin or user), used to compute remaining refundable.
    amount_refunded: float = 0.0

    # Boolean true/false that is true if paid and false otherwise
    payment_complete: bool

    # Optional value that denotes the discount code id, if any, that was used to sign up
    discount_code_id: Optional[str]

    # Denotes whether or not the particular registrant is eligible for automatic refund
    # Is False by default, if something happens that makes them eligible, will become True
    automatic_refund_eligibility: bool

    # String that either points to an ID of a PayPal transaction for events or None (if door or free)
    transaction_id: Optional[str]

    # String that either points to the line ID of a PayPal transaction or None (if door or free)
    line_id: Optional[str]

    # Boolean that determines if the registration was forced or not
    is_forced: bool = False

class RegistrationDetails(BaseModel):
    """
    Contains details regarding how a user has registered
    """
    # Boolean that denotates whether the user themself has signed up for an event
    self_registered: bool
    # List of strings of objectID of their family members that have signed up for a particular event
    family_registered: List[str]
    # Payment Details regarding how self paid. None if user not a part of the event
    self_payment_details: Optional[PaymentDetails]
    # Dict to family id --> PaymentDetails of particular payment status of each registrant
    family_payment_details: Dict[str, PaymentDetails]

class EventInstanceOverrides(BaseModel):
    """
    This is a class that defines the overrides to apply to EventInstances to differ from the Event Blueprint
    """
    localizations: Optional[Dict[str, EventLocalization]] = None
    date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    hidden: Optional[bool] = None
    registration_allowed: Optional[bool] = None
    registration_opens: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    automatic_refund_deadline: Optional[datetime] = None
    members_only: Optional[bool] = None
    rsvp_required: Optional[bool] = None
    max_spots: Optional[int] = None
    price: Optional[float] = None
    member_price: Optional[float] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    gender: Optional[Literal["all", "male", "female"]] = None
    location_address: Optional[str] = None
    image_id: Optional[str] = None
    payment_options: Optional[List[Literal['paypal', 'door']]] = None



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

    # Overrides Tracker is a list of bools that checks if each group of overrides is active or not
    overrides_tracker: List[bool]

    # Initial date of the event
    event_date: datetime




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

    # Overrides Tracker is a list of bools that checks if each group of overrides is active or not
    # Believe it or not, is important for DST validation and correction
    overrides_tracker: List[bool]
                            
    # Initial date of the event
    event_date: datetime


# This is a small class that is specifically made when viewing event details to point to other event intsances to visit of the same event
class SisterInstanceIdentifier(BaseModel):
    id: str
    date: str
    updated_on: str
    event_date: str




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

async def increment_amount_refunded_for_line(
    *,
    event_instance_id: str,
    uid: str,
    person_id: str,   # "SELF" or a family_id
    amount: float,
) -> None:
    """
    Best-effort helper to increase PaymentDetails.amount_refunded
    for a single registration line on an event instance.

    It does NOT change seats_filled or registration flags; it only touches the
    nested payment details blob, and only if that blob already exists.
    """
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return

    if amt <= 0:
        return

    try:
        _oid = ObjectId(event_instance_id)
    except Exception:
        return

    # Base path to the PaymentDetails object
    if person_id == "SELF":
        base = f"registration_details.{uid}.self_payment_details"
    else:
        base = f"registration_details.{uid}.family_payment_details.{person_id}"

    field_path = f"{base}.amount_refunded"

    # Only update if a PaymentDetails object is actually there
    filter_doc = {
        "_id": _oid,
        f"{base}.payment_type": {"$exists": True},
    }

    await DB.db["event_instances"].update_one(
        filter_doc,
        {"$inc": {field_path: amt}},
    )

def _assemble_event_instance_for_read(
    *,
    instance_doc: Dict[str, Any],
    event_doc: Dict[str, Any],
    preferred_lang: Optional[str],
    uid: Optional[str],
    favorites_event_ids: Optional[List[str]],
    validate: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Shared assembly: seeds from parent Event, applies instance overrides,
    computes registration windows by deltas, derives localization defaults,
    applies per-user annotations (registrations, favorites), then guards hidden.

    Returns:
      dict (assembled) or None (if effectively hidden).
    """
    inst_overrides: Dict[str, Any] = instance_doc.get("overrides") or {}

    # scheduled date: override -> scheduled_date -> target_date
    scheduled_date = (
        inst_overrides.get("date")
        or instance_doc.get("scheduled_date")
        or instance_doc.get("target_date")
    )

    # 1) seed from parent
    assembled: Dict[str, Any] = {}
    for k in [
        "localizations", "recurring", "registration_allowed", "hidden",
        "registration_opens", "registration_deadline", "automatic_refund_deadline", "ministries",
        "members_only", "rsvp_required", "max_spots", "price",
        "min_age", "max_age", "gender", "location_address", "image_id",
        "payment_options", "member_price", "updated_on", "end_date"
    ]:
        if k in event_doc:
            assembled[k] = event_doc[k]

    # 2) identifiers & instance
    assembled["id"] = str(instance_doc["_id"])
    assembled["event_id"] = instance_doc["event_id"]
    assembled["series_index"] = int(instance_doc.get("series_index") or 0)
    assembled["seats_filled"] = int(instance_doc.get("seats_filled") or 0)
    assembled["date"] = scheduled_date
    assembled['overrides_tracker'] = instance_doc.get("overrides_tracker")

    # 3) registration windows from deltas (unless instance overrides later)
    parent_date = event_doc.get("date")
    assembled['event_date'] = parent_date
    parent_open = event_doc.get("registration_opens")
    parent_deadline = event_doc.get("registration_deadline")
    parent_refund_deadline = event_doc.get("automatic_refund_deadline")
    parent_end_date = event_doc.get("end_date")
    delta_open = (parent_open - parent_date) if (parent_open and parent_date) else None
    delta_deadline = (parent_deadline - parent_date) if (parent_deadline and parent_date) else None
    delta_refund_deadline = (parent_refund_deadline - parent_date) if (parent_refund_deadline and parent_date) else None
    delta_end_date = (parent_end_date - parent_date) if (parent_end_date and parent_date) else None
    assembled["registration_opens"] = (scheduled_date + delta_open) if delta_open is not None else None
    assembled["registration_deadline"] = (scheduled_date + delta_deadline) if delta_deadline is not None else None
    assembled['automatic_refund_deadline'] = (scheduled_date + delta_refund_deadline) if delta_refund_deadline is not None else None
    assembled['end_date'] = (scheduled_date + delta_end_date) if delta_end_date is not None else None

    # 4) apply instance overrides
    for k in [
        "localizations","registration_allowed","hidden","members_only","rsvp_required",
        "max_spots","price","member_price","payment_options",
        "min_age","max_age","gender","location_address","image_id",
        "registration_opens","registration_deadline", 'automatic_refund_deadline', 'end_date'
    ]:
        if k in inst_overrides:
            v = inst_overrides[k]
            if v is not None or k in overrides_allowed_none:
                assembled[k] = v
                

    # 5) localization defaults
    effective_localizations = assembled.get("localizations") or {}
    loc_key = _preferred_locale_key(effective_localizations, preferred_lang)
    loc = effective_localizations.get(loc_key, {}) or {}
    assembled["default_title"] = loc.get("title") or ""
    assembled["default_description"] = loc.get("description") or ""
    assembled["default_location_info"] = loc.get("location_info") or ""
    assembled["default_localization"] = loc_key

    # 6) timestamps
    assembled["overrides_date_updated_on"] = instance_doc.get("overrides_date_updated_on") or event_doc.get("updated_on")
    assembled["updated_on"] = event_doc.get("updated_on")

    # 7) per-user registration flags
    has_regs, regs = _apply_uid_registrations(instance_doc, uid)
    assembled["has_registrations"] = has_regs
    assembled["event_registrations"] = regs if has_regs else None

    # 8) favorited annotation
    fav_set = set(favorites_event_ids or [])
    assembled["is_favorited"] = (assembled["event_id"] in fav_set) if fav_set else False

    # Final guard: effectively hidden
    if assembled.get("hidden") is True:
        return None

    if validate:
        # Validate against your Pydantic ReadEventInstance and return a plain dict
        return ReadEventInstance(**assembled).model_dump()

    return assembled

def _assemble_event_instance_for_admin(
    *,
    instance_doc: Dict[str, Any],
    event_doc: Dict[str, Any],
    preferred_lang: Optional[str] = None,
    validate: bool = True,
) -> Dict[str, Any]:
    """
    Assemble an EventInstance for admin/ops views into an AssembledEventInstance shape.

    - Seeds from parent Event, applies instance overrides (overrides win).
    - 'date' reflects the scheduled occurrence (override.date -> instance.scheduled_date -> instance.target_date).
    - Registration windows are re-derived from *scheduled* occurrence using parent deltas.
    - Populates default localization fields based on preferred_lang (falling back to 'en' or first available).
    """
    inst_overrides: Dict[str, Any] = instance_doc.get("overrides") or {}

    # Determine the concrete scheduled date for this occurrence
    scheduled_date = (
        inst_overrides.get("date")
        or instance_doc.get("scheduled_date")
        or instance_doc.get("target_date")
    )

    # Seed from parent event
    assembled: Dict[str, Any] = {}
    for k in [
        "localizations", "recurring", "registration_allowed", "hidden",
        "members_only", "rsvp_required", "max_spots", "price", "member_price",
        "min_age", "max_age", "gender", "location_address", "image_id",
        "payment_options", "ministries", "updated_on",
        "discount_codes", 'end_date'
    ]:
        if k in event_doc:
            assembled[k] = event_doc[k]

    # Identifiers + instance-level fields
    assembled["id"] = str(instance_doc["_id"])
    assembled["event_id"] = instance_doc["event_id"]
    assembled["series_index"] = int(instance_doc.get("series_index") or 0)
    assembled["seats_filled"] = int(instance_doc.get("seats_filled") or 0)
    assembled["registration_details"] = instance_doc.get("registration_details") or {}
    assembled["target_date"] = instance_doc.get("target_date")
    assembled["date"] = scheduled_date  # concrete occurrence date for UI
    assembled["event_date"] = event_doc.get("date")
    assembled["overrides_date_updated_on"] = (
        instance_doc.get("overrides_date_updated_on") or event_doc.get("updated_on")
    )
    assembled['overrides_tracker'] = instance_doc.get('overrides_tracker')

    # Recompute opens/deadline from parent deltas based on *scheduled* date
    parent_date = event_doc.get("date")
    parent_open = event_doc.get("registration_opens")
    parent_deadline = event_doc.get("registration_deadline")
    parent_refund_deadline = event_doc.get("automatic_refund_deadline")
    parent_end_date = event_doc.get("end_date")
    delta_open = (parent_open - parent_date) if (parent_open and parent_date) else None
    delta_deadline = (parent_deadline - parent_date) if (parent_deadline and parent_date) else None
    delta_refund_deadline = (parent_refund_deadline - parent_date) if (parent_refund_deadline and parent_date) else None
    delta_end_date = (parent_end_date - parent_date) if (parent_end_date and parent_date) else None
    assembled["registration_opens"] = (scheduled_date + delta_open) if delta_open is not None else None
    assembled["registration_deadline"] = (scheduled_date + delta_deadline) if delta_deadline is not None else None
    assembled['automatic_refund_deadline'] = (scheduled_date + delta_refund_deadline) if delta_refund_deadline is not None else None
    assembled['end_date'] = (scheduled_date + delta_end_date) if delta_end_date is not None else None

    # Apply instance overrides (overrides win)
    for k in [
        "localizations", "registration_allowed", "hidden", "members_only", "rsvp_required",
        "max_spots", "price", "member_price", "payment_options",
        "min_age", "max_age", "gender", "location_address", "image_id",
        "registration_opens", "registration_deadline", "automatic_refund_deadline", "ministries", "date", "end_date"
    ]:
        if k in inst_overrides:
            assembled[k] = inst_overrides[k]

    # Default localization block
    effective_localizations = assembled.get("localizations") or {}
    loc_key = _preferred_locale_key(effective_localizations, preferred_lang)
    loc = effective_localizations.get(loc_key, {}) or {}
    assembled["default_title"] = loc.get("title") or ""
    assembled["default_description"] = loc.get("description") or ""
    assembled["default_location_info"] = loc.get("location_info") or ""
    assembled["default_localization"] = loc_key

    if validate:
        # Validate against Pydantic and return a plain dict
        return AssembledEventInstance(**assembled).model_dump()

    return assembled

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
    async with _PUBLISH_MUTEX:
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
                    "overrides_date_updated_on": event_doc.get("updated_on"),
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
                    "overrides_date_updated_on": event_doc.get("updated_on"),
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
    async with _PUBLISH_MUTEX:
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

            # If no future instances, then nothing to update, still bump timestamps for consistency
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
                # 3. The editor TZ itself
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

    items: List[Dict[str, Any]] = []
    async for inst in cursor:
        items.append(
            _assemble_event_instance_for_admin(
                instance_doc=inst,
                event_doc=parent,
                preferred_lang=preferred_lang,
                validate=True,
            )
        )

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


async def get_event_instance_for_read_by_id(
    instance_id: str,
    *,
    uid: Optional[str] = None,
    preferred_lang: Optional[str] = "en",
    favorites_event_ids: Optional[List[str]] = None
) -> Optional[Dict[str, Any]]:
    try:
        _oid = ObjectId(instance_id)
    except Exception:
        return None

    pipeline = [
        {"$match": {"_id": _oid}},
        {"$addFields": {"event_oid": {"$toObjectId": "$event_id"}}},
        {"$lookup": {
            "from": "events",
            "localField": "event_oid",
            "foreignField": "_id",
            "as": "event_doc",
        }},
        {"$unwind": "$event_doc"},
        {"$replaceRoot": {"newRoot": {"$mergeObjects": ["$$ROOT", {"event": "$event_doc"}]}}},
    ]

    cur = DB.db["event_instances"].aggregate(pipeline)
    docs = await cur.to_list(length=1)
    if not docs:
        return None

    doc = docs[0]
    return _assemble_event_instance_for_read(
        instance_doc=doc,
        event_doc=doc["event"],
        preferred_lang=preferred_lang,
        uid=uid,
        favorites_event_ids=favorites_event_ids or [],
        validate=True,
    )

async def get_event_instance_assembly_by_id(
    instance_id: str,
    *,
    preferred_lang: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch a single EventInstance document by its _id, join its parent Event,
    and return an assembled AssembledEventInstance payload (admin view).
    """
    try:
        _oid = ObjectId(instance_id)
    except Exception:
        return None

    pipeline = [
        {"$match": {"_id": _oid}},
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
        {"$replaceRoot": {"newRoot": {"$mergeObjects": ["$event_doc", {"instance": "$$ROOT"}]}}},
    ]

    cur = DB.db["event_instances"].aggregate(pipeline)
    doc = await cur.to_list(length=1)
    if not doc:
        return None

    # After $replaceRoot above, `doc[0]` has parent event fields at top-level,
    # and the original instance doc under "instance".
    parent_event = doc[0]
    instance = parent_event.pop("instance", {})

    return _assemble_event_instance_for_admin(
        instance_doc=instance,
        event_doc=parent_event,
        preferred_lang=preferred_lang,
        validate=True,
    )

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
                    {"_id": {"$gte": ObjectId(cursor_id)}} if cursor_id else {"_id": {"$exists": True}},
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
                "hidden": {
                    "$switch": {
                        "branches": [
                            {
                                "case": {"$eq": ["$overrides.hidden", True]},
                                "then": True
                            },
                            {
                                "case": {"$eq": ["$overrides.hidden", False]},
                                "then": False
                            },
                        ],
                        "default": {"$ifNull": ["$event.hidden", False]},
                    }
                },
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

    next_cursor: Optional[Dict[str, Any]] = None

    if len(rows) > limit:
        last = rows.pop()
        next_cursor = {
            "scheduled_date": last["scheduled_date"].isoformat(),
            "id": str(last["_id"]),
        }

    assembled: List[Dict[str, Any]] = []
    for doc in rows:
        full = _assemble_event_instance_for_read(
            instance_doc=doc,
            event_doc=doc["event"],
            preferred_lang=preferred_lang or "en",
            uid=uid,
            favorites_event_ids=favorites_event_ids or [],
            validate=True,
        )
        if full is not None:
            assembled.append(full)

    return {'items':assembled, 'next_cursor':next_cursor}

async def search_my_event_instances_for_read(
    *,
    uid: str,
    preferred_lang: Optional[str] = "en",
    favorites_event_ids: Optional[List[str]] = None,
    type_filter: Literal[
        "favorites_and_registered",
        "registered",
        "registered_not_favorited",
        "favorites",
        "favorites_not_registered",
    ] = "favorites_and_registered",
    date_filter: Literal["upcoming", "history", "all"] = "upcoming",
    limit: int = 20,
    cursor_scheduled_date: Optional[datetime] = None,
    cursor_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Focused search for a user's events (favorites / registrations).

    - Assembles each instance with _assemble_event_instance_for_read (respects effective 'hidden').
    - Filters by:
        type_filter:
          * 'favorites_and_registered'
          * 'registered'
          * 'registered_not_favorited'
          * 'favorites'
          * 'favorites_not_registered'
        date_filter (by scheduled_date):
          * 'upcoming'  -> scheduled_date > now (ascending)
          * 'history'   -> scheduled_date < now (descending)
          * 'all'       -> no date bound (ascending)
    - Pagination compatible with search_upcoming_event_instances_for_read via
      (cursor_scheduled_date, cursor_id).

    Returns:
      {
        "items": [ReadEventInstance...],
        "next_cursor": {"scheduled_date": <iso/datetime>, "id": <str>} | None
      }
    """

    coll = DB.db["event_instances"]
    now = datetime.now(timezone.utc)

    # ---- base date window
    match_base: Dict[str, Any] = {}
    if date_filter == "upcoming":
        match_base["scheduled_date"] = {"$gt": now}
        sort_dir = 1
    elif date_filter == "history":
        match_base["scheduled_date"] = {"$lt": now}
        sort_dir = -1
    else:
        sort_dir = 1

    # ---- cursor pagination
    if cursor_scheduled_date is not None and cursor_id is not None:
        if date_filter == "history":
            # descending: include the cursor row (<=)
            after = {
                "$or": [
                    {"scheduled_date": {"$lt": cursor_scheduled_date}},
                    {"scheduled_date": cursor_scheduled_date, "_id": {"$lte": ObjectId(cursor_id)}},
                ]
            }
        else:
            # ascending: include the cursor row (>=)
            after = {
                "$or": [
                    {"scheduled_date": {"$gt": cursor_scheduled_date}},
                    {"scheduled_date": cursor_scheduled_date, "_id": {"$gte": ObjectId(cursor_id)}},
                ]
            }
        match_base = {"$and": [match_base, after]} if match_base else after

    pipeline: List[Dict[str, Any]] = [{"$match": match_base}]

    # ---- pre-filter by favorites / registrations to keep the set small
    favs = favorites_event_ids or []
    reg_key = f"registration_details.{str(uid)}"

    fav_match = None
    reg_match = None

    if type_filter in ("favorites_and_registered", "favorites", "favorites_not_registered"):
        if favs:
            fav_match = {"event_id": {"$in": favs}}
        else:
            # No favorites: ensure favorites-only branches short-circuit
            fav_match = {"_id": {"$exists": False}}  # matches nothing

    if type_filter in ("favorites_and_registered", "registered", "registered_not_favorited"):
        reg_match = {reg_key: {"$exists": True}}

    # Compose pre-filter
    if fav_match and reg_match:
        if type_filter == "favorites_and_registered":
            pipeline.append({"$match": {"$or": [fav_match, reg_match]}})
        elif type_filter == "registered_not_favorited":
            pipeline.append({"$match": reg_match})
        elif type_filter == "favorites_not_registered":
            pipeline.append({"$match": fav_match})
    elif fav_match:
        pipeline.append({"$match": fav_match})
    elif reg_match:
        pipeline.append({"$match": reg_match})
    else:
        # e.g., favorites-only with no favorites
        return {"items": [], "next_cursor": None}

    # ---- join parent Event for assembly
    pipeline += [
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
        {"$sort": {"scheduled_date": sort_dir, "_id": sort_dir}},
        {"$limit": limit + 1},  # page+1 to compute next_cursor
    ]

    # ---- execute + assemble + post-assembly filtering (hidden, overrides, etc.)
    items: List[Dict[str, Any]] = []
    count = 0
    peek_cursor: Optional[Dict[str, Any]] = None  # the first extra row that passed all filters

    async for doc in coll.aggregate(pipeline):
        event_doc = doc.get("event_doc") or {}
        assembled = _assemble_event_instance_for_read(
            instance_doc=doc,
            event_doc=event_doc,
            preferred_lang=preferred_lang,
            uid=uid,
            favorites_event_ids=favorites_event_ids,
            validate=True,
        )
        if not assembled:
            continue

        # Post-assembly truth for final type constraints
        is_fav = assembled.get("event_id") in (favorites_event_ids or [])
        is_reg = bool(assembled.get("has_registrations"))
        if type_filter == "favorites_and_registered":
            keep = is_fav or is_reg
        elif type_filter == "registered":
            keep = is_reg
        elif type_filter == "registered_not_favorited":
            keep = is_reg and not is_fav
        elif type_filter == "favorites":
            keep = is_fav
        elif type_filter == "favorites_not_registered":
            keep = is_fav and not is_reg
        else:
            keep = False
        if not keep:
            continue

        count += 1
        if count <= limit:
            items.append(assembled)
        else:
            # First extra row that *would* follow this page: use it to build the cursor.
            sched = doc.get("scheduled_date")
            _id = doc.get("_id")
            if isinstance(_id, ObjectId):
                _id = str(_id)
            peek_cursor = {
                "scheduled_date": sched.isoformat() if hasattr(sched, "isoformat") else str(sched),
                "id": str(_id),
            }
            break

    next_cursor = peek_cursor if peek_cursor else None
    return {"items": items, "next_cursor": next_cursor}

# ------------------------------
# Other CRUD Operations
# ------------------------------

async def will_delete_details(details:RegistrationDetails):
    if details.self_registered == False and len(details.family_registered) == 0:
        return True
    return False

async def update_registration(
    event_instance_id: str,
    uid: str,
    details: RegistrationDetails,
    seat_delta: int,
    capacity_limit: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Atomically updates a single user's RegistrationDetails and adjusts seats_filled
    with capacity/underflow protection in the query predicate.

    Args:
      event_instance_id: instance _id (string)
      uid: user id (string)
      details: new RegistrationDetails for this user
      seat_delta: +N when adding registrants, -N when removing, 0 when no seat change
      capacity_limit: effective max_spots for this instance (None means unlimited)
    Returns:
      {success: bool, msg?: str, seats_filled?: int, registration_details?: dict}
    """
    # Validate id
    try:
        oid = ObjectId(event_instance_id)
    except Exception:
        return {"success": False, "msg": "Invalid event_instance_id."}

    coll = DB.db["event_instances"]
    details_dict = details.model_dump() if hasattr(details, "model_dump") else dict(details)

    # ---- Build conditional predicate for atomic capacity safety ----
    pred: Dict[str, Any] = {"_id": oid}

    # Add capacity check when we are increasing seats AND there is a finite capacity
    if seat_delta > 0 and capacity_limit is not None:
        pred["$expr"] = {
            "$lte": [
                {"$add": ["$seats_filled", int(seat_delta)]},
                int(capacity_limit),
            ]
        }

    # Add underflow protection when decreasing seats
    # (If you prefer clamping to 0 instead of rejecting, remove this block and use the pipeline form.)
    if seat_delta < 0:
        # If the predicate already has $expr (from capacity_limit), combine with $and
        expr_underflow = {
            "$gte": [
                {"$add": ["$seats_filled", int(seat_delta)]},
                0
            ]
        }
        if "$expr" in pred:
            pred["$and"] = [{"$expr": pred.pop("$expr")}, {"$expr": expr_underflow}]
        else:
            pred["$expr"] = expr_underflow

     # ---- Build the atomic update ----
    # Decide whether to unset (delete) this user's registration_details entirely
    remove_user = await will_delete_details(details)

    update_doc: Dict[str, Any] = {}
    if remove_user:
        # Delete the entry from the registration_details dict
        update_doc["$unset"] = {f"registration_details.{str(uid)}": ""}
    else:
        # Upsert/replace this user's registration_details
        update_doc["$set"] = {f"registration_details.{str(uid)}": details_dict}

    # Use $inc only when seat_delta != 0; otherwise omit it to avoid no-op write semantics
    if seat_delta != 0:
        update_doc["$inc"] = {"seats_filled": int(seat_delta)}

    res = await coll.update_one(pred, update_doc)

    # If nothing matched, the predicate failed (capacity race/underflow) or the doc didn't exist
    if getattr(res, "matched_count", 0) == 0:
        # Disambiguate a bit for better DX
        exists = await coll.count_documents({"_id": oid}, limit=1)
        if not exists:
            return {"success": False, "msg": "Event instance not found."}
        if seat_delta > 0 and capacity_limit is not None:
            return {"success": False, "msg": "Capacity exceeded during update."}
        if seat_delta < 0:
            return {"success": False, "msg": "Underflow: seats would drop below 0."}
        # seat_delta == 0 but matched_count==0 is unusual; treat as not found just in case
        return {"success": False, "msg": "Update preconditions not met."}

    # Fetch the fresh seats_filled + the caller's registration_details back for convenience
    doc = await coll.find_one(
        {"_id": oid},
        projection={"seats_filled": 1, "registration_details": 1},
    )
    return {
        "success": True,
        "seats_filled": int(doc.get("seats_filled", 0)),
        "registration_details": (doc.get("registration_details") or {}).get(str(uid)),
        "change_request": details
    }

async def get_sister_upcoming_identifiers(event_id: str, instance_id: str) -> List[SisterInstanceIdentifier]:
    """
    Returns SisterInstanceIdentifier[] for the same event_id, excluding the given instance_id,
    only for upcoming instances (scheduled_date strictly after now, in UTC), and not effectively hidden.
    """
    try:
        instances = DB.db["event_instances"]

        # Normalize event_id
        try:
            event_key = str(ObjectId(event_id))
        except Exception:
            event_key = str(event_id)

        # Optional exclude
        try:
            exclude_oid = ObjectId(instance_id)
        except Exception:
            exclude_oid = None

        now = datetime.now(timezone.utc)

        match_base: Dict[str, Any] = {
            "event_id": event_key,
            "scheduled_date": {"$gt": now},
        }
        if exclude_oid is not None:
            match_base["_id"] = {"$ne": exclude_oid}

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
            # Effective hidden = event.hidden || overrides.hidden
            {"$addFields": {
                "eff_hidden": {
                    "$switch": {
                        "branches": [
                            {
                                "case": {"$eq": ["$overrides.hidden", True]},
                                "then": True
                            },
                            {
                                "case": {"$eq": ["$overrides.hidden", False]},
                                "then": False
                            },
                        ],
                        "default": {"$ifNull": ["$event_doc.hidden", False]},
                    }
                },
            }},
            {"$match": {"eff_hidden": {"$ne": True}}},
            {"$sort": {"scheduled_date": 1, "_id": 1}},
            # ⬇️ Project everything the frontend needs
            {"$project": {
                "_id": 1,
                "scheduled_date": 1,
                "overrides_date_updated_on": 1,
                "event_doc.date": 1,
            }},
        ]

        cur = instances.aggregate(pipeline)
        docs = await cur.to_list(length=None)
        if not docs:
            return []

        out: List[SisterInstanceIdentifier] = []
        for d in docs:
            scheduled = d.get("scheduled_date")
            updated_on = d.get("overrides_date_updated_on")
            event_doc = d.get("event_doc") or {}
            event_date = event_doc.get("date")

            # Stringify defensively
            date_str = scheduled.isoformat() if isinstance(scheduled, datetime) else str(scheduled)
            up_str = updated_on.isoformat() if isinstance(updated_on, datetime) else str(updated_on)
            event_str = event_date.isoformat() if isinstance(event_date, datetime) else str(event_date)

            out.append(SisterInstanceIdentifier(
                id=str(d["_id"]),
                date=date_str,
                updated_on=up_str,
                event_date=event_str,
            ))

        return out
    except Exception:
        logging.exception("get_sister_upcoming_identifiers failed")
        return []
    
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

    now = datetime.now(timezone.utc)

    cursor = collection.find(
        {"event_id": key_str, "scheduled_date": {"$gt": now}}
    ).sort("scheduled_date", 1)

    docs = await cursor.to_list(length=None)
    return docs

async def get_upcoming_instances_for_user_family(uid: str, family_id: str) -> List[dict]:
    """
    Returns raw instance docs that are scheduled in the future AND have this family_id
    listed under registration_details.<uid>.family_registered.
    """

    now = datetime.now(timezone.utc)

    coll = DB.db['event_instances']
    cursor = coll.find({
        "scheduled_date": {"$gt": now},
        f"registration_details.{uid}.family_registered": family_id,
    })

    return await cursor.to_list(length=10000)

async def get_upcoming_instances_for_user(uid: str) -> List[dict]:

    now = datetime.now(timezone.utc)
    coll = DB.db['event_instances']
    cursor = coll.find({
        "scheduled_date": {"$gt": now},
        f"registration_details.{uid}": {"$exists": True},
    })
    return await cursor.to_list(length=10000)

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
    

