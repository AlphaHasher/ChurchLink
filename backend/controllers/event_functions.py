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
    High-level action: RSVP an event *and* reflect it in the user's my_events.
    scope: "series" for recurring registration, "occurrence" for one-time registration
    payment_option: "paypal", "door", "free", or None (legacy parameter, not used in new architecture)
    transaction_id: Payment transaction ID for linking to Transaction model
    Returns: (success, reason)
    """
    # Convert person_id to ObjectId if provided
    person_object_id = ObjectId(person_id) if person_id else None
    
    ok, reason = await rsvp_add_person(event_id, uid, person_object_id, display_name, kind="rsvp", scope=scope, transaction_id=transaction_id)
    if not ok:
        return False, reason

    # Check if event requires payment - if so, skip my_events creation until payment is complete
    event = await get_event_by_id(event_id)
    is_paid_event = event and event.price > 0 and hasattr(event, 'payment_options') and event.payment_options
    
    # Only add to my_events if:
    # 1. It's a free event (no payment required), OR
    # 2. It's a paid event but payment is already completed (transaction_id provided)
    should_add_to_my_events = not is_paid_event or transaction_id is not None
    
    if should_add_to_my_events:
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
    else:
        # For paid events without payment, my_events will be created during payment success
        logging.info(f"Skipping my_events creation for paid event {event_id} - will be created after payment")

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
    payment_option: str = "paypal",
    donation_amount: float = 0.0
) -> tuple[bool, str]:
    """
    Register multiple people for an event using the provided registration data.
    
    Args:
        event_id: The event ID to register for
        uid: The user ID performing the registration  
        registrations: List of registration dicts with person_id and display_name
        payment_option: Payment method used ("paypal", "door", "free")
        donation_amount: Optional donation amount (currently not used)
        
    Returns:
        tuple[bool, str]: (success, message)
    """
    try:
        successful_registrations = []
        failed_registrations = []
        
        for registration in registrations:
            person_id = registration.get('person_id')  # None for self, ObjectId string for family members
            display_name = registration.get('display_name', registration.get('name'))
            
            # Register this person
            success, reason = await register_rsvp(
                event_id=event_id,
                uid=uid,
                person_id=person_id,
                display_name=display_name,
                scope="occurrence",  # Single event registration for PayPal payments
                payment_option=payment_option
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
        logging.error(f"Error in register_multiple_people: {str(e)}")
        return False, f"Registration failed due to error: {str(e)}"

