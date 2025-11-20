from fastapi import HTTPException, status, Request
from models.event import create_event, get_event_by_id, get_event_doc_by_id, update_event, delete_event, do_event_validation ,EventUpdate, remove_discount_code_from_all_events
from models.event_instance import EventInstanceOverrides,override_groups, allowed_overrides,push_event_instances_by_event_id, recalculate_published_dates, delete_event_instances_from_event_id, get_instance_by_event_and_series_index, overrides_allowed_none, get_event_instance_assembly_by_id, AssembledEventInstance, get_upcoming_instances_from_event_id, get_instances_from_event_id
from models.discount_code import delete_discount_code
from models.user import get_person_dict, get_user_by_uid
from mongo.database import DB
from bson import ObjectId
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel
from models.event_transaction import get_transaction_by_order_id, append_refund_to_item

from helpers.PayPalHelperV2 import PayPalHelperV2

import logging
import os
import json

class EventDiscountCodesUpdate(BaseModel):
    event_id: str 
    discount_codes: List[str] 

allowed_override_args = allowed_overrides.copy()


# --- Snapshot helpers --------------------------------------------------------

def _json_default(o: Any):
    if isinstance(o, (datetime, )):
        return o.isoformat()
    if isinstance(o, ObjectId):
        return str(o)
    # fall back to string
    return str(o)

def _coerce_for_json(doc: Any) -> Any:
    """
    Deep-serialize a document (dict/list/primitives) so json.dumps won't choke
    on ObjectId/datetime. We also ensure keys stay strings.
    """
    if isinstance(doc, dict):
        return {str(k): _coerce_for_json(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_coerce_for_json(v) for v in doc]
    if isinstance(doc, (datetime, ObjectId)):
        return _json_default(doc)
    return doc

async def _write_deleted_event_snapshot(event_doc: dict, instance_docs: List[dict]) -> Optional[str]:
    """
    Write deleted_event_records/{event_id}.json with a snapshot of the event
    and all of its instances (as they were before deletion).

    Returns the file path on success, or None on failure.
    """
    try:
        event_id_str = str(event_doc.get("id"))
        payload = {
            "snapshot_time": datetime.utcnow().isoformat() + "Z",
            "event_id": event_id_str,
            "event": _coerce_for_json(event_doc),
            "instances": _coerce_for_json(instance_docs),
        }
        out_dir = os.path.join(os.getcwd(), "deleted_event_records")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{event_id_str}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        logging.info("[delete_event] snapshot written: %s", out_path)
        return out_path
    except Exception:
        logging.exception("[delete_event] failed to write deleted event snapshot")
        return None



async def process_create_event(event: EventUpdate):
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

async def process_edit_event(event_id: str, event: EventUpdate):
    
    # Find event in mongo
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        return {"success": False, "msg":"Error: Original event not found!"}
    
    success = await update_event(event_id, event)
    if not success['success']:
        return success
    
    try:
        recalculate = await recalculate_published_dates(event_id)
        if not recalculate['success']:
            return {'success':False, 'msg':f"Warning! Event update was successful, but we failed to recalculate the dates for event instances! Error: {recalculate['msg']}"}
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

async def _refund_paypal_lines_for_instance(instance_doc: dict, by_uid: str) -> dict:
    """
    Refund all PayPal-completed lines on a single event instance.

    Returns {success: bool, msg: str, refunded: list[(label, refund_id, amount)]}
    """
    reg_map = (instance_doc or {}).get("registration_details") or {}
    if not isinstance(reg_map, dict) or not reg_map:
        return {"success": True, "msg": "No registrations on instance.", "refunded": []}

    # Build candidate list across ALL users on the instance
    candidates = []  # (label, payment_details)

    for uid, details in reg_map.items():
        if not isinstance(details, dict):
            continue

        # SELF
        if details.get("self_registered") and details.get("self_payment_details"):
            candidates.append((f"SELF (uid:{uid})", details["self_payment_details"]))

        # FAMILY
        fam_ids = details.get("family_registered") or []
        fam_pd = details.get("family_payment_details") or {}
        for fid in fam_ids:
            pd = fam_pd.get(str(fid)) or fam_pd.get(fid)
            if pd:
                candidates.append((f"{fid} (uid:{uid})", pd))

    if not candidates:
        return {"success": True, "msg": "No refundable PayPal payments.", "refunded": []}

    paypal = await PayPalHelperV2.get_instance()
    await paypal.start()

    refunded = []
    for label, pd in candidates:
        try:
            if (pd.get("payment_type") != "paypal") or (not pd.get("payment_complete")):
                continue

            order_id = pd.get("transaction_id")
            line_id = pd.get("line_id")
            amount = float(pd.get("price") or 0.0)
            if not order_id or not line_id or amount <= 0:
                continue

            tx = await get_transaction_by_order_id(order_id)
            if not tx:
                logging.critical(f"Refund failed for {label}: transaction not found.")
                continue

            item = next((it for it in (tx.items or []) if it.line_id == line_id), None)
            capture_id = getattr(item, "capture_id", None) if item else None
            if not capture_id:
                logging.critical(f"Refund failed for {label}: captured line not found.")
                continue

            req_id = f"refund:{order_id}:{line_id}"
            resp = await paypal.post(
                f"/v2/payments/captures/{capture_id}/refund",
                json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
                request_id=req_id,
            )
            if resp.status_code not in (200, 201):
                logging.critical(f"Refund failed for {label}: PayPal {resp.status_code}.")
                continue

            rj = resp.json()
            refund_id = rj.get("id")
            if not refund_id:
                logging.critical(f"Refund failed for {label}: missing refund id.")
                continue

            ok = await append_refund_to_item(
                order_id=order_id,
                line_id=line_id,
                refund_id=refund_id,
                amount=round(amount, 2),
                reason="event_deleted",
                by_uid=by_uid,
            )
            if not ok:
                logging.critical(f"Refund failed for {label}: ledger write failed.")
                continue

            refunded.append((label, refund_id, round(amount, 2)))
        except Exception as e:
            return {"success": False, "msg": f"Refund failed for {label}: {e}"}

    return {"success": True, "msg": "Refunds processed.", "refunded": refunded}


async def process_delete_event(event_id: str, request: Request):
    # 0) Load the event we intend to delete
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        return {"success": False, "msg": "Error: couldn't find original event to delete!"}

    # 1) Refund all PayPal registrants for UPCOMING instances
    try:
        upcoming = await get_upcoming_instances_from_event_id(event_id)
    except Exception as e:
        return {"success": False, "msg": f"Failed to scan upcoming instances: {e}"}

    for inst in (upcoming or []):
        res = await _refund_paypal_lines_for_instance(inst, by_uid=request.state.uid)
        if not res.get("success"):
            logging.critical(f"EVENT REFUND ERROR DETECTED WHILE DELETING EVENT! BE SURE TO MAKE SURE THIS IS AS EXPECTED! ERROR: {res.get('msg','Refund error')}")

    # 2) Gather ALL instance docs now (pre-delete) for snapshot
    try:
        all_instances = await get_instances_from_event_id(event_id)
    except Exception as e:
        return {"success": False, "msg": f"Failed to load instances for snapshot: {e}"}

    # 3) Write snapshot file before we actually delete anything
    snap_path = await _write_deleted_event_snapshot(old_event.model_dump(), all_instances)
    if not snap_path:
        # To be ultra-safe, abort if we couldn't record the state
        return {"success": False, "msg": "Event deletion aborted. Failed to write deletion snapshot."}

    # 4) Delete all instances (past + future)
    try:
        delete = await delete_event_instances_from_event_id(event_id)
        if not delete or not delete.get("success"):
            return {
                "success": False,
                "msg": f"Event deletion aborted. Failed to delete instances: {(delete or {}).get('msg','unknown error')}",
            }
    except Exception as e:
        return {"success": False, "msg": f"Event deletion aborted. Deleting instances threw: {e}"}

    # 5) Delete event
    success = await delete_event(event_id)
    if not success.get("success"):
        return success

    return {
        "success": True,
        "msg": "Event and instances deleted with refunds where applicable (snapshot saved).",
        "snapshot_path": snap_path,
    }

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
    try:
        assembly = EventInstanceOverrides.model_validate(new_overrides)
    except Exception as exc:
       return {"success": False, "msg": f"Invalid overrides payload: {exc}"}

    return {
        "success": True,
        "overrides": new_overrides,
        "assembly": assembly,
        "tracker": new_tracker,
    }
    



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
        if k not in ("registration_opens", "registration_deadline", "automatic_refund_deadline", "end_date"):  # handle after delta calc
            effective[k] = v

    # Compute registration window fields
    parent_date: Optional[datetime] = parent_event.get("date")
    parent_open: Optional[datetime] = parent_event.get("registration_opens")
    parent_deadline: Optional[datetime] = parent_event.get("registration_deadline")
    parent_refund_deadline: Optional[datetime] = parent_event.get("automatic_refund_deadline")
    parent_end_date: Optional[datetime] = parent_event.get("end_date")

    delta_open = (parent_open - parent_date) if (parent_open and parent_date) else None
    delta_deadline = (parent_deadline - parent_date) if (parent_deadline and parent_date) else None
    delta_refund_deadline = (parent_refund_deadline - parent_date) if (parent_refund_deadline and parent_date) else None
    delta_end_date = (parent_end_date - parent_date) if (parent_end_date and parent_date) else None


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

    if 'end_date' in overrides_dict:
        effective['end_date'] = overrides_dict.get("end_date")
    else:
        effective['end_date'] = (instance_date + delta_end_date) if delta_end_date is not None else None

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
        if not old_instance:
            return {"success": False, "msg": "Event instance not found for provided series_index."}
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

    user = await get_user_by_uid(user_id)
    if user is None:
        return {'success':False, 'msg':'This user does not exist!'}
    
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