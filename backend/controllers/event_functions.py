from fastapi import APIRouter, HTTPException, status, Request
from models.event import create_event, EventCreate, get_event_by_id, update_event, delete_event, rsvp_add_person, rsvp_remove_person
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from bson import ObjectId
from typing import Optional
import logging

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

async def register_rsvp(event_id: str, uid: str, person_id: Optional[str] = None, display_name: Optional[str] = None, scope: str = "series", payment_option: Optional[str] = None, transaction_id: Optional[str] = None):
    """
    Register a user for an event and update their personal event tracking.
    
    This function handles event registration by adding the person to the event's 
    participant list and reflecting the registration in the user's my_events collection
    for personal tracking and management.
    
    Args:
        event_id: The unique identifier of the event to register for
        uid: The user ID of the person performing the registration
        person_id: Optional person ID (ObjectId string) for registering family members.
                  If None, registers the user themselves
        display_name: The name to display for this registration
        scope: Registration scope - "series" for recurring events, "occurrence" for single events
        payment_option: Payment method indicator ("paypal", "door", "free", or None)
        transaction_id: Payment transaction ID for linking to Transaction model records.
                       Used for payment tracking and audit trails
    
    Returns:
        tuple[bool, str]: A tuple containing:
            - bool: True if registration successful, False otherwise
            - str: Success message or error reason
    
    Example:
        success, message = await register_rsvp(
            event_id="event123",
            uid="user456", 
            display_name="John Doe",
            scope="occurrence",
            transaction_id="txn_789"
        )
    """
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    
    ok, reason = await rsvp_add_person(event_id, uid, person_object_id, display_name, kind="rsvp", scope=scope, transaction_id=transaction_id)
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


async def register_multiple_people(
    event_id: str,
    uid: str,
    registrations: list,
    *,
    parent_transaction_id: str | None = None,
) -> tuple[bool, str]:
    """
    Register multiple people for an event with proper transaction linkage.
    
    Args:
        event_id: The event ID to register for
        uid: The user ID performing the registration  
        registrations: List of registration dicts with person_id, display_name, 
                      and optional transaction_id
        parent_transaction_id: Default transaction ID to use for registrations
                              that don't specify their own transaction_id
        
    Returns:
        tuple[bool, str]: (success, message)
    
    Note:
        Each registration can include a 'transaction_id' field for individual
        transaction tracking. Falls back to parent_transaction_id if not specified.
    """
    try:
        successful_registrations = []
        failed_registrations = []
        
        for registration in registrations:
            person_id = registration.get('person_id')  # None for self, ObjectId string for family members
            display_name = registration.get('display_name', registration.get('name'))
            child_tx = registration.get('transaction_id') or parent_transaction_id
            
            # Register this person
            success, reason = await register_rsvp(
                event_id=event_id,
                uid=uid,
                person_id=person_id,
                display_name=display_name,
                scope="occurrence",  # Single event registration for bulk payments
                transaction_id=child_tx,
            )
            
            if success:
                successful_registrations.append(display_name or f"Person {person_id}" if person_id else "Self")
                logging.info(f"Successfully registered {display_name} for event {event_id}")
            else:
                failed_registrations.append(f"{display_name}: {reason}")
                logging.error(f"Failed to register {display_name} for event {event_id}: {reason}")
        
        # Determine overall success
        total_registrations = len(registrations)
        successful_count = len(successful_registrations)
        
        if successful_count == total_registrations:
            return True, f"Successfully registered all {successful_count} people"
        elif successful_count > 0:
            return True, f"Registered {successful_count}/{total_registrations} people. Failed: {', '.join(failed_registrations)}"
        else:
            return False, f"Failed to register any people: {', '.join(failed_registrations)}"
            
    except Exception as e:
        logging.exception("Error in register_multiple_people")
        return False, f"Registration failed due to error: {str(e)}"

