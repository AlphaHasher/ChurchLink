from fastapi import APIRouter, HTTPException, status, Request
from models.event import create_event, EventCreate, get_event_by_id, update_event, delete_event, rsvp_add_person, rsvp_remove_person
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from bson import ObjectId
from typing import Optional, List

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

async def register_rsvp(event_id: str, uid: str, person_id: Optional[str] = None, display_name: Optional[str] = None, scope: str = "series", payment_option: Optional[str] = None):
    """
    High-level action: RSVP an event *and* reflect it in the user's my_events.
    scope: "series" for recurring registration, "occurrence" for one-time registration
    
    Args:
        payment_option: 'paypal', 'door', or None for free events
    """
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    
    print(f"DEBUG: Attempting RSVP for event_id={event_id}, uid={uid}, person_id={person_id}, scope={scope}, payment_option={payment_option}")
    
    # Determine payment status based on payment option
    payment_status = None
    if payment_option == 'door':
        payment_status = 'pending_door'  # Payment to be collected at the door
    elif payment_option == 'paypal':
        payment_status = 'awaiting_payment'  # Will be updated when PayPal payment completes
    # For free events or no payment option, payment_status remains None
    
    ok, reason = await rsvp_add_person(event_id, uid, person_object_id, display_name, payment_status=payment_status, scope=scope)
    if not ok:
        print(f"DEBUG: rsvp_add_person failed for event_id={event_id}, uid={uid}, reason={reason}")
        return False, reason

    try:
        await UserHandler.add_to_my_events(
            uid=uid,
            event_id=ObjectId(event_id),
            reason="rsvp",
            scope=scope,
            person_id=person_object_id,
            payment_method=payment_option,
            payment_status=payment_status
        )
        print(f"DEBUG: Successfully registered user {uid} for event {event_id} with payment option {payment_option}, status {payment_status}")
    except Exception as e:
        # Event RSVP succeeded, but user record failed
        print(f"Warning: user my_events update failed: {e}")

    return True, "success"


async def cancel_rsvp(event_id: str, uid: str, person_id: Optional[str] = None, scope: Optional[str] = None):
    """
    High-level action: cancel RSVP from event + user my_events.
    If scope is None, removes all registrations for this person (both occurrence and series).
    If scope is specified, only removes that specific scope registration.
    """
    print(f"DEBUG: cancel_rsvp called - event_id: {event_id}, uid: {uid}, person_id: {person_id}, scope: {scope}")
    
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    
    print(f"DEBUG: Attempting to remove person from event - person_object_id: {person_object_id}")
    ok = await rsvp_remove_person(event_id, uid, person_object_id, kind="rsvp", scope=scope)
    
    print(f"DEBUG: rsvp_remove_person result: {ok}")
    if not ok:
        return False

    try:
        print(f"DEBUG: Attempting to remove from user my_events")
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
        print(f"DEBUG: Successfully removed from my_events")
    except Exception as e:
        print(f"Warning: user my_events cleanup failed: {e}")
    
    return True


async def register_multiple_people(
    event_id: str, 
    uid: str, 
    registrations: List[dict], 
    payment_option: Optional[str] = None,
    donation_amount: float = 0.0
) -> tuple[bool, str]:
    """
    Unified registration function that handles single or multiple people registration.
    
    Args:
        event_id: Event ID to register for
        uid: User ID making the registration
        registrations: List of registration objects with 'person_id' (optional) and 'name'
        payment_option: 'paypal', 'door', or None for free events
        donation_amount: Optional donation amount for the entire registration
    
    Returns:
        (success, message) tuple
    """
    print(f"DEBUG: Registering {len(registrations)} people for event {event_id}")
    
    successful_registrations = []
    failed_registrations = []
    
    # Determine payment status based on payment option
    payment_status = None
    if payment_option == 'door':
        payment_status = 'pending_door'
    elif payment_option == 'paypal':
        payment_status = 'awaiting_payment'
    
    # Register each person
    for registration in registrations:
        person_id = registration.get('person_id')  # None for self, ObjectId string for family members
        display_name = registration.get('name', '')
        
        try:
            success, reason = await register_rsvp(
                event_id=event_id,
                uid=uid,
                person_id=person_id,
                display_name=display_name,
                payment_option=payment_option
            )
            
            if success:
                successful_registrations.append(display_name)
                print(f"DEBUG: Successfully registered {display_name}")
            else:
                failed_registrations.append(f"{display_name}: {reason}")
                print(f"DEBUG: Failed to register {display_name}: {reason}")
                
        except Exception as e:
            failed_registrations.append(f"{display_name}: {str(e)}")
            print(f"ERROR: Exception registering {display_name}: {e}")
    
    # Determine overall result
    if len(successful_registrations) == len(registrations):
        return True, f"Successfully registered {', '.join(successful_registrations)}"
    elif len(successful_registrations) > 0:
        return True, f"Partially successful: {', '.join(successful_registrations)} registered. Failed: {'; '.join(failed_registrations)}"
    else:
        return False, f"All registrations failed: {'; '.join(failed_registrations)}"

