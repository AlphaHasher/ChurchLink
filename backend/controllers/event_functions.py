from fastapi import APIRouter, HTTPException, status, Request
from models.event import create_event, EventCreate, get_event_by_id, update_event, delete_event, rsvp_add_person, rsvp_remove_person
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from bson import ObjectId
from typing import Optional

async def process_create_event(event: EventCreate, request:Request):
    # Verify Event has Roles Attached
    if len(event.roles) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: No Roles Attached to Event")
    
    # Gather user perms and roles
    user_perms = request.state.perms
    user_roles = request.state.roles

    # If user is not an Admin, Event Manager, or Event Editor, refuse
    if not user_perms['admin'] and not user_perms['event_editing'] and not user_perms['event_management']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: Invalid Permissions")
    # Verify user has permissions to include all requested event locks
    if not user_perms['admin'] and not user_perms['event_management']:
        for role in event.roles:
            if role not in user_roles:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: Tried to add a Permission Role you do not have access to")

    created_event = await create_event(event)
    if created_event is None:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event (maybe duplicate name/data?)")
    return created_event

async def process_edit_event(event_id: str, event: EventCreate, request:Request):
    # Verify Event has Roles Attached
    if len(event.roles) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: No Roles Attached to Event")
    
    # Gather user perms and roles
    user_perms = request.state.perms
    user_roles = request.state.roles

    # If user is not an Admin, Event Manager, or Event Editor, refuse
    if not user_perms['admin'] and not user_perms['event_editing'] and not user_perms['event_management']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Invalid Permissions")
    
    # Find event in mongo
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Unable to find original event")
    
    # Verify user has at least one permission needed to modify event
    if not user_perms['admin'] and not user_perms['event_management']:
        perms_found = False
        for role in old_event.roles:
            if role in user_roles:
                perms_found = True
                break
        if not perms_found:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: User Does Not Have Permissions Access to Event")
    
    # Verify that if event roles changed user has permissions
    if (event.roles != old_event.roles) and (not user_perms['admin'] and not user_perms['event_management']):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Only an Administrator or Event Manager can edit an Existing Event's Perm Roles")
    
    success = await update_event(event_id, event)
    if not success:
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found or update failed")
    return {"message": "Event updated successfully", "success": True}

async def process_delete_event(event_id:str, request:Request):

    # Gather user perms and roles
    user_perms = request.state.perms
    user_roles = request.state.roles

    # If user is not an Admin, Event Manager, or Event Editor, refuse
    if not user_perms['admin'] and not user_perms['event_editing'] and not user_perms['event_management']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Invalid Permissions")
    
    # Find event in mongo
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Unable to find original event")
    
    # Verify user has at least one permission needed to modify event
    if not user_perms['admin'] and not user_perms['event_management']:
        perms_found = False
        for role in old_event.roles:
            if role in user_roles:
                perms_found = True
                break
        if not perms_found:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: User Does Not Have Permissions Access to Event")
    
    success = await delete_event(event_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return {"message": "Event deleted successfully", "success": True}

async def register_rsvp(event_id: str, uid: str, person_id: Optional[str] = None, display_name: Optional[str] = None, payment_option: Optional[str] = None):
    """
    High-level action: RSVP an event *and* reflect it in the user's my_events.
    Returns (success, reason) tuple.
    
    Args:
        payment_option: 'paypal', 'door', or None for free events
    """
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    
    print(f"DEBUG: Attempting RSVP for event_id={event_id}, uid={uid}, person_id={person_id}, payment_option={payment_option}")
    
    # Determine payment status based on payment option
    payment_status = None
    if payment_option == 'door':
        payment_status = 'pending'  # Payment to be collected at the door
    elif payment_option == 'paypal':
        payment_status = 'awaiting_payment'  # Will be updated when PayPal payment completes
    # For free events or no payment option, payment_status remains None
    
    ok, reason = await rsvp_add_person(event_id, uid, person_object_id, display_name, payment_status=payment_status)
    if not ok:
        print(f"DEBUG: rsvp_add_person failed for event_id={event_id}, uid={uid}, reason={reason}")
        return False, reason

    try:
        await UserHandler.add_to_my_events(
            uid=uid,
            event_id=ObjectId(event_id),
            reason="rsvp",
            scope="series",  # or "occurrence" depending on your model
            person_id=person_object_id
        )
        print(f"DEBUG: Successfully registered user {uid} for event {event_id} with payment option {payment_option}")
    except Exception as e:
        # Event RSVP succeeded, but user record failed.
        # Log this for reconciliation later.
        print(f"Warning: user my_events update failed: {e}")

    return True, "success"


async def cancel_rsvp(event_id: str, uid: str, person_id: Optional[str] = None):
    """
    High-level action: cancel RSVP from event + user my_events.
    """
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    ok = await rsvp_remove_person(event_id, uid, person_object_id)
    if not ok:
        return False

    try:
        await UserHandler.remove_from_my_events(
            uid=uid,
            event_id=ObjectId(event_id),
            reason="rsvp",
            scope="series",
            person_id=person_object_id,
        )
    except Exception as e:
        print(f"Warning: user my_events cleanup failed: {e}")
    return True

