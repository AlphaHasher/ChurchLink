from fastapi import HTTPException, status, Request
from models.event import create_event, get_event_by_id, get_event_doc_by_id, update_event, delete_event, do_event_validation ,EventUpdate, remove_discount_code_from_all_events
from models.event_instance import EventInstanceOverrides,override_groups, allowed_overrides,push_event_instances_by_event_id, recalculate_published_dates, delete_event_instances_from_event_id, get_instance_by_event_and_series_index, overrides_allowed_none, get_event_instance_assembly_by_id, AssembledEventInstance
from models.discount_code import delete_discount_code
from models.user import get_person_dict
from mongo.database import DB
from bson import ObjectId
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel

class EventDiscountCodesUpdate(BaseModel):
    event_id: str 
    discount_codes: List[str] 

allowed_override_args = allowed_overrides.copy()

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
    except Exception as e:
        return {'success':False, 'msg':f"Warning! Event update was successful, but we failed to recalculate the dates for event instances! Exception: {e}"}
    
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
                if override in overrides:
                    new_overrides[override] = overrides.get(override)
                else:
                    new_overrides[override] = old_event.get(override) or None
        flag_index += 1

    # Assemble as override instance
    assembly = EventInstanceOverrides.model_validate(new_overrides)

    if assembly:
        # Return overrides and tracker
        return {'success':True, 'overrides': new_overrides, 'assembly':assembly, 'tracker': new_tracker}
    else:
        return {'success':False}
    



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
        if k not in ("registration_opens", "registration_deadline", "automatic_refund_deadline"):  # handle after delta calc
            effective[k] = v

    # Compute registration window fields
    parent_date: Optional[datetime] = parent_event.get("date")
    parent_open: Optional[datetime] = parent_event.get("registration_opens")
    parent_deadline: Optional[datetime] = parent_event.get("registration_deadline")
    parent_refund_deadline: Optional[datetime] = parent_event.get("automatic_refund_deadline")

    delta_open = (parent_open - parent_date) if (parent_open and parent_date) else None
    delta_deadline = (parent_deadline - parent_date) if (parent_deadline and parent_date) else None
    delta_refund_deadline = (parent_refund_deadline - parent_date) if (parent_refund_deadline and parent_date) else None

    # If overrides explicitly provided (group 5), use them; else recompute via deltas
    if "registration_opens" in overrides_dict:
        effective["registration_opens"] = overrides_dict.get("registration_opens")
    else:
        effective["registration_opens"] = (instance_date + delta_open) if delta_open is not None else None

    if "registration_deadline" in overrides_dict:
        effective["registration_deadline"] = overrides_dict.get("registration_deadline")
    else:
        effective["registration_deadline"] = (instance_date + delta_deadline) if delta_deadline is not None else None

    if "automatic_refund_deadline" in overrides_dict:
        effective["automatic_refund_deadline"] = overrides_dict.get("automatic_refund_deadline")
    else:
        effective['automatic_refund_deadline'] = (instance_date + delta_refund_deadline) if delta_refund_deadline is not None else None

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
        if key not in allowed_override_args:
            return {'success':False, 'msg':f'Overrides contains forbidden key: {key}'}
        
    # Fetch parent event
    parent_event = await get_event_doc_by_id(event_id)
    if not parent_event:
        return {"success": False, "msg": "Parent event not found."}
    
    # Determine if the date the overrides should set should point to right now or when events were updated depending on if date is in the overrides
    if "date" in overrides:
        overrides_update_date = datetime.now(timezone.utc)
        iso_str = overrides["date"]
        if iso_str.endswith("Z"):
            iso_str = iso_str.replace("Z", "+00:00")
        scheduled_date = datetime.fromisoformat(iso_str)
    else:
        overrides_update_date = parent_event.get("updated_on")
        old_instance = await get_instance_by_event_and_series_index(event_id, series_index)
        scheduled_date = old_instance.get("target_date")

    # Package overrides by groups
    package = await package_overrides(overrides, parent_event)
    if not package['success']:
        return {'success':False, 'msg':'Could not validate overrides!'}
    
    assembly_dict = package['assembly'].model_dump(exclude_none=True)
    tracker = package["tracker"]

    # For every override tracker
    flag_index = 0
    # If flag is true, then every override in that group needs to be defined
    for flag in tracker:
        # Define overrides
        if flag:
            for override in override_groups[flag_index]:
                if override not in assembly_dict:
                    if override in overrides_allowed_none:
                        assembly_dict[override] = None
                    else:
                        assembly_dict[override] = parent_event.get(override)
        flag_index += 1

    # Fetch the target instance
    try:
        key_str = str(ObjectId(event_id))
    except Exception:
        key_str = str(event_id)

    instance_coll = DB.db["event_instances"]
    instance_doc = await instance_coll.find_one({"event_id": key_str, "series_index": int(series_index)})
    if not instance_doc:
        return {"success": False, "msg": "Event instance not found for provided series_index."}

    effective_event = _assemble_effective_event_for_instance(parent_event, instance_doc, assembly_dict)

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
            "overrides": assembly_dict,
            "overrides_tracker": tracker,
            "overrides_date_updated_on": overrides_update_date,
            "scheduled_date": scheduled_date,
        }
    }
    await instance_coll.update_one({"_id": instance_doc["_id"]}, update)

    return {"success": True, "msg": "Overrides updated successfully.", "overrides_applied": assembly_dict, "overrides_tracker": tracker}


async def fetch_admin_instance_assembly_by_id(instance_id: str, preferred_lang: Optional[str] = None):
    """
    Fetch a single assembled (admin) EventInstance payload by instance_id.
    Returns a stable {success, msg, instance, preferred_lang} envelope for the router.
    """
    try:
        instance = await get_event_instance_assembly_by_id(
            instance_id,
            preferred_lang=preferred_lang,
        )
        if not instance:
            return {
                "success": False,
                "msg": "Event instance not found.",
                "instance": None,
                "preferred_lang": preferred_lang or "",
            }
        return {
            "success": True,
            "msg": "Instance returned successfully.",
            "instance": instance,
            "preferred_lang": preferred_lang or "",
        }
    except Exception as e:
        return {
            "success": False,
            "msg": f"Failed to fetch instance assembly: {e}",
            "instance": None,
            "preferred_lang": preferred_lang or "",
        }
    
async def process_set_event_discount_codes(payload: EventDiscountCodesUpdate):
    """
    Admin-only: Update the `discount_codes` list for an event.
    - Validates that event exists
    - Validates that each discount code ID exists
    - Deduplicates provided IDs
    """
    # 1) Validate event exists
    try:
        event_oid = ObjectId(payload.event_id)
    except Exception:
        return {"success": False, "msg": "Invalid event_id."}

    event_doc = await DB.db["events"].find_one({"_id": event_oid})
    if not event_doc:
        return {"success": False, "msg": "Event not found."}

    # 2) Normalize & validate discount code ids
    unique_ids: List[str] = list(dict.fromkeys(payload.discount_codes))  # preserve order, drop dups
    code_oids = []
    for s in unique_ids:
        try:
            code_oids.append(ObjectId(s))
        except Exception:
            return {"success": False, "msg": f"Invalid discount code id: {s}"}

    if code_oids:
        existing = await DB.db["discount_codes"].count_documents({"_id": {"$in": code_oids}})
        if existing != len(code_oids):
            return {"success": False, "msg": "One or more discount code IDs do not exist."}

    # 3) Update event’s discount_codes (store as strings to match Event model)
    #    Also bump updated_on to keep parity with other event updates.
    str_ids = [str(x) for x in code_oids]
    res = await DB.db["events"].update_one(
        {"_id": event_oid},
        {"$set": {"discount_codes": str_ids, "updated_on": datetime.now(timezone.utc)}},
    )
    if res.modified_count == 0:
        # It might be a no-op (same values). Treat as success for idempotency.
        pass

    # 4) Return the updated event (assembled like other admin reads)
    from models.event import get_event_by_id  # local import to avoid circulars
    updated = await get_event_by_id(str(event_oid))
    if not updated:
        return {"success": False, "msg": "Event updated, but failed to re-fetch event."}

    return {"success": True, "msg": "Discount codes updated for event!", "event": updated}

async def process_delete_discount_code(code_id: str):
    """
    1) Remove the code id from all events' discount_codes
    2) Delete the discount code document
    Returns: {success, msg, affected_events}
    """
    # Step 1: pull from all events first (avoid dangling references if step 2 fails)
    pulled = await remove_discount_code_from_all_events(code_id)
    if not pulled.get("success"):
        return {"success": False, "msg": pulled.get("msg", "Failed to update events."), "affected_events": 0}

    # Step 2: delete the code
    deleted = await delete_discount_code(code_id)
    if not deleted.get("success"):
        # Optional: If delete fails, you could re-add, but we keep it simple: references are already removed.
        return {"success": False, "msg": deleted.get("msg", "Failed to delete code."), "affected_events": pulled.get("modified_count", 0)}

    return {
        "success": True,
        "msg": f"Deleted discount code and removed it from {pulled.get('modified_count', 0)} event(s).",
        "affected_events": pulled.get("modified_count", 0),
    }

async def get_user_registration_info(instance_id:str, user_id:str):
    """
    THIS FUNCTION RETURNS MANY THINGS!
    THE PURPOSE OF THIS IS TO GET EVENT DETAILS + REGISTRATION DETAILS OF A PARTICULAR EVENT INSTANCE FROM A PARTICULAR USER!
    """

    # Try to get instance by ID
    # NOTE: The full RegistrationDetails lives on the instance.
    # Therefore, no particular additional search will be needed to get the details by a person
    instance_doc = await get_event_instance_assembly_by_id(instance_id)

    # If we have no found instance, return an error
    if instance_doc is None:
        return {'success':False, 'msg':f'Could not find the event instance with id {instance_id}', 'event_instance':None, 'person_dict': None}

    instance = AssembledEventInstance(**instance_doc)
    
    # NOTE: Based off the RegistrationDetails we only have IDs and raw SELF.
    # This means that we would have no means of displaying names, gender, dob etc of these people just based off the instance details
    # Thus, we need to do additional searches.

    person_dict = await get_person_dict(user_id)

    # Now, think about a particular case of viewing a past event and the person gets deleted or something like this.
    # Or, if the person dict otherwise failed to get properly.
    # To account for this, lets make it safer by including default values.
    default_map = {'first_name':'UNKNOWN', 'last_name':'NAME', 'DOB':None, 'gender':None}

    # Account for SELF not having details
    if 'SELF' not in person_dict:
        person_dict['SELF'] = default_map

    # Account for each person not having details
    if instance.registration_details is not None and user_id in instance.registration_details:
        for family in instance.registration_details[user_id].family_registered:
            if family not in person_dict:
                person_dict[family] = default_map
    
    # Return all information
    return {'success':True, 'msg':'Successfully returned user registration details!', 'event_instance':instance.model_dump(), 'person_dict':person_dict}