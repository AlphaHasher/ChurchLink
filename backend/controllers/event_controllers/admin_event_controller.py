from fastapi import HTTPException, status, Request
from models.event import create_event, get_event_by_id, get_event_doc_by_id, update_event, delete_event, do_event_validation ,EventUpdate
from models.event_instance import EventInstanceOverrides,override_groups, allowed_overrides,push_event_instances_by_event_id, recalculate_published_dates, delete_event_instances_from_event_id, get_instance_by_event_and_series_index
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from mongo.database import DB
from bson import ObjectId
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timezone

async def process_create_event(event: EventUpdate, request:Request):
    # Gather user perms
    user_perms = request.state.perms
    
    # Verify user has permissions to include all requested event locks
    if not user_perms['admin'] and not user_perms['event_management']:
        for ministry in event.ministries:
            # TODO: CHANGE TO ACTUAL USE MINISTRIES CHECK!
            if False:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: Tried to add a Permission Role you do not have access to")

    created_event = await create_event(event)
    if created_event is None:
        return {"success": False, "msg":"Error creating event!"}
    if not created_event['success']:
        return created_event
    try:
        published = await push_event_instances_by_event_id(created_event['event'].id)
        if published['success']:
            return created_event
        else:
            return {"success":False, "msg":f"Warning! Event creation was successful, but publishing was unsuccessful due to error {published['msg']}"}
    except Exception as e:
        return {"success": False, "msg":f"Warning! Event creation was successful, but publishing was unsuccessful due to error {e}"}

async def process_edit_event(event_id: str, event: EventUpdate, request:Request):
    # Gather user perms
    user_perms = request.state.perms
    
    # Find event in mongo
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        return {"success": False, "msg":"Error: Original event not found!"}
    
    # TODO: ADD MINISTRY LOCK TO ENSURE USER HAS ACCESS TO THIS EVENT
    
    success = await update_event(event_id, event)
    if not success:
        return {"success": False, "msg":"Error: Event update failed!"}
    if not success['success']:
        return success
    
    try:
        recalculate = await recalculate_published_dates(event_id)
        if not recalculate['success']:
            return {'success':False, 'msg':f"Warning! Event update was successful, but we failed to recalculate the dates for event instances! Error: {recalculate['message']}"}
    except:
        return {'success':False, 'msg':f"Warning! Event update was successful, but we failed to recalculate the dates for event instances!"}
    
    try:
        published = await push_event_instances_by_event_id(event_id)
        if published['success']:
            return success
        else:
            return {"success":False, "msg":f"Warning! Event editing was successful, but publishing was unsuccessful due to error {published['msg']}"}
    except Exception as e:
        return {"success": False, "msg":f"Warning! Event editing was successful, but publishing was unsuccessful due to error {e}"}

async def process_delete_event(event_id:str, request:Request):

    # Gather user perms and roles
    user_perms = request.state.perms

    # Find event in mongo
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        return {"success": False, "msg":"Error: couldn't find original event to delete!"}
    
    # TODO ADD MINISTRY LOCK
    success = await delete_event(event_id)
    if not success:
        return {"success":False, "msg": "Event deletion failed due to an unknown error!"}
    if not success['success']:
        return success
    
    try:
        delete = await delete_event_instances_from_event_id(event_id)
        if not delete:
            return {'success':False, 'msg':"Event deletion was successful, but deleting the event instances failed due to an unknown error!"}
        if delete['success']:
            return success
        if not delete['success']:
            return {'success':False, 'msg':f"Event deletion was successful, but deleting the event instances failed due to error: {delete['msg']}"}
    except Exception as e:
        return {'success':False, 'msg':f"Event deletion was successful, but deleting the event instances failed due to error: {e}"}


async def package_overrides(overrides: Dict[str, Any], old_event):
    # Init new blank overrides and tracker
    new_overrides = {}
    new_tracker = [False, False, False, False, False, False, False]

    # For every override group, run a loop
    group_index = 0
    for group in override_groups:
        # For every particular override in a group, run a loop
        for override in group:
            # If the override was provided in the overrides list, set that override group as being needed to be written to as a whole
            if override in overrides:
                new_tracker[group_index] = True
                break
        group_index += 1

    # For every override tracker
    flag_index = 0
    # If flag is true, then every override in that group needs to be defined
    for flag in new_tracker:
        # Define overrides
        if flag:
            for override in override_groups[flag_index]:
                new_overrides[override] = overrides.get(override)
        flag_index += 1

    # Assemble as override instance
    assembled_overrides = EventInstanceOverrides.model_validate(new_overrides)

    # Return overrides and tracker
    return {'overrides': assembled_overrides, 'tracker': new_tracker}


def _assemble_effective_event_for_instance(parent_event: Dict[str, Any],
                                           instance_doc: Dict[str, Any],
                                           overrides_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Construct an 'effective event' payload (dict) for a specific instance by
    merging the parent event with the instance's overrides.
    This is the object we pass into do_event_validation().

    Rules:
    - Base from parent EventCore + Event metadata the validator expects.
    - Instance date defaults to instance.target_date; if overrides.date is present, use it.
    - registration_opens/deadline:
        * If group 5 fields provided in overrides, use them as-is (even if None).
        * Otherwise, recompute by preserving the deltas from parent: (reg_* - parent.date) + instance_date
    - Other fields: shallow-merge overrides onto parent.
    """
    # Minimal set the validator relies on (but we keep parent fields broadly)
    effective = dict(parent_event)

    # Determine base instance date (scheduled_date) and override if provided
    scheduled_date: datetime = instance_doc.get("scheduled_date")
    instance_date: datetime = overrides_dict.get("date") or scheduled_date
    effective["date"] = instance_date

    # For validator: ensure these are present if they exist on the parent
    # Preserve ministries/max_published/image/payment fields etc. from parent unless overridden
    # Apply overrides shallowly (except reg windows handled below)
    for k, v in overrides_dict.items():
        if k not in ("registration_opens", "registration_deadline"):  # handle after delta calc
            effective[k] = v

    # Compute registration window fields
    parent_date: Optional[datetime] = parent_event.get("date")
    parent_open: Optional[datetime] = parent_event.get("registration_opens")
    parent_deadline: Optional[datetime] = parent_event.get("registration_deadline")

    delta_open = (parent_open - parent_date) if (parent_open and parent_date) else None
    delta_deadline = (parent_deadline - parent_date) if (parent_deadline and parent_date) else None

    # If overrides explicitly provided (group 5), use them; else recompute via deltas
    if "registration_opens" in overrides_dict:
        effective["registration_opens"] = overrides_dict.get("registration_opens")
    else:
        effective["registration_opens"] = (instance_date + delta_open) if delta_open is not None else None

    if "registration_deadline" in overrides_dict:
        effective["registration_deadline"] = overrides_dict.get("registration_deadline")
    else:
        effective["registration_deadline"] = (instance_date + delta_deadline) if delta_deadline is not None else None

    # A couple of defensive defaults that the validator references
    # Ensure payment_options exist as list if not provided
    if effective.get("payment_options") is None:
        effective["payment_options"] = []

    # Ensure max_published present (validator checks bounds)
    if "max_published" not in effective:
        effective["max_published"] = 1

    return effective

async def process_instance_overrides(overrides: Dict[str, Any], event_id: str, series_index: int):
    """
    1) Package the provided overrides into grouped 'all-or-none' sets + tracker.
    2) Fetch the parent Event doc and the specific EventInstance doc.
    3) Assemble an effective event payload by merging parent + overrides for this instance.
    4) Run do_event_validation() on that assembled payload (skip 'date in future' to allow past edits).
    5) If valid, persist overrides + tracker on the instance.
    """

    # Validate valid overrides dictionary
    # Return success is False if it contains any keys not explicitly allowed
    for key, value in overrides.items():
        if key not in allowed_overrides:
            return {'success':False, 'msg':f'Overrides contains forbidden key: {key}'}
        
    # Fetch parent event
    parent_event = await get_event_doc_by_id(event_id)
    if not parent_event:
        return {"success": False, "msg": "Parent event not found."}
    
    # Determine if the date the overrides should set should point to right now or when events were updated depending on if date is in the overrides
    if "date" in overrides:
        overrides_update_date = datetime.now(timezone.utc)
        scheduled_date = datetime.fromisoformat(overrides['date'])
    else:
        overrides_update_date = parent_event.get("updated_on")
        old_instance = await get_instance_by_event_and_series_index(event_id, series_index)
        scheduled_date = old_instance.get("target_date")

    # Package overrides by groups
    package = await package_overrides(overrides, parent_event)
    new_overrides_obj: EventInstanceOverrides = package["overrides"]
    tracker = package["tracker"]

    # Fetch the target instance
    try:
        key_str = str(ObjectId(event_id))
    except Exception:
        key_str = str(event_id)

    instance_coll = DB.db["event_instances"]
    instance_doc = await instance_coll.find_one({"event_id": key_str, "series_index": int(series_index)})
    if not instance_doc:
        return {"success": False, "msg": "Event instance not found for provided series_index."}

    # Build an 'effective event' dict and validate
    overrides_dict = new_overrides_obj.model_dump(exclude_none=True)
    effective_event = _assemble_effective_event_for_instance(parent_event, instance_doc, overrides_dict)

    date_check = False
    if 'date' in overrides:
        date_check = True

    # IMPORTANT: skip 'date in future' during overrides so past occurrences can be edited if needed
    validation = do_event_validation(effective_event, validate_date=date_check)
    if not validation.get("success"):
        return {"success": False, "msg": validation.get("msg", "Validation failed.")}
    


    # Persist the overrides + tracker on the instance
    update = {
        "$set": {
            "overrides": overrides_dict,
            "overrides_tracker": tracker,
            "overrides_date_updated_on": overrides_update_date,
            "scheduled_date": scheduled_date,
        }
    }
    await instance_coll.update_one({"_id": instance_doc["_id"]}, update)

    return {"success": True, "msg": "Overrides updated successfully.", "overrides_applied": overrides_dict, "overrides_tracker": tracker}



# TODO: I COMMENTED THIS TO LOOK AT IT LATER WHEN REGISTRATION IS READY!
'''
async def register_rsvp(event_id: str, uid: str, person_id: Optional[str] = None, display_name: Optional[str] = None, scope: str = "series", payment_option: Optional[str] = None):
    """
    High-level action: RSVP an event *and* reflect it in the user's my_events.
    scope: "series" for recurring registration, "occurrence" for one-time registration
    payment_option: "paypal", "door", "free", or None
    Returns: (success, reason)
    """
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    
    # Map payment option to payment status
    payment_status = None
    if payment_option == "door":
        payment_status = "pending_door"
    elif payment_option == "paypal":
        payment_status = "awaiting_payment"
    elif payment_option == "free":
        payment_status = None  # Free events don't need payment status
    # If payment_option is None, payment_status remains None (free registration)
    
    ok, reason = await rsvp_add_person(event_id, uid, person_object_id, display_name, kind="rsvp", scope=scope, payment_status=payment_status)
    if not ok:
        return False, reason

    try:
        await UserHandler.add_to_my_events(
            uid=uid,
            event_id=ObjectId(event_id),
            reason="rsvp",
            scope=scope,
            person_id=person_object_id
        )
    except Exception as e:
        # Event RSVP succeeded, but user record failed
        logging.warning(f"Warning: user my_events update failed: {e}")

    return True, "success"


async def cancel_rsvp(event_id: str, uid: str, person_id: Optional[str] = None, scope: Optional[str] = None):
    """
    High-level action: cancel RSVP from event + user my_events.
    If scope is None, removes all registrations for this person (both occurrence and series).
    If scope is specified, only removes that specific scope registration.
    """
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    ok = await rsvp_remove_person(event_id, uid, person_object_id, kind="rsvp", scope=scope)
    if not ok:
        return False

    try:
        # Try to remove from my_events with the specified scope
        removed = await UserHandler.remove_from_my_events(
            uid=uid,
            event_id=ObjectId(event_id),
            reason="rsvp",
            scope=scope,
            person_id=person_object_id,
        )
        
        if not removed and scope is not None:
            # FALLBACK: Try the opposite scope if the specified one wasn't found
            opposite_scope = 'occurrence' if scope == 'series' else 'series'
            removed = await UserHandler.remove_from_my_events(
                uid=uid,
                event_id=ObjectId(event_id),
                reason="rsvp",
                scope=opposite_scope,
                person_id=person_object_id,
            )
    except Exception as e:
        logging.warning(f"Warning: user my_events cleanup failed: {e}")
    
    return True
'''
