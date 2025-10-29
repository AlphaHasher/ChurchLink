
# TODO: RECONCILE THIS BUSINESS

'''from fastapi import APIRouter, HTTPException, status, Request, Body, Query, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models.event import  EventCreate, search_events, delete_events, get_event_by_id
from controllers.event_functions import process_create_event, process_edit_event, process_delete_event, register_rsvp, cancel_rsvp
from models.user import get_family_member_by_id
from models.event import rsvp_list
from typing import Literal, List, Dict
from bson import ObjectId
from typing import Optional
from datetime import date, datetime
from models.event import get_all_ministries
from datetime import date as date_type
from models.event import get_event_by_id
from models.event import rsvp_list
from controllers.users_functions import resolve_user_name, resolve_family_member_name, create_display_name
from models.event import get_event_payment_summary, get_event_registrations_by_payment_status
from models.transaction import Transaction
from helpers.UserResolutionHelper import UserResolutionHelper
from datetime import datetime, timedelta
import random
import logging

security = HTTPBearer(auto_error=False)




event_editing_router = APIRouter(prefix="/events", tags=["Events Editing Routes"])

public_event_router = APIRouter(prefix="/events", tags=["Events Public Routes"])

private_event_router = APIRouter(prefix="/events", tags=["Events Authenticated Routes"])

mod_event_router = APIRouter(prefix="/events", tags=["Events Moderator Routes"])


# Public Router
@public_event_router.get("/{event_id}", summary="Get event by ID")
async def get_event_by_id_route(event_id: str):
    """Get a single event by its ID"""
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


# Public Router
@public_event_router.get("/{event_id}/registrations/public", response_model=dict)
async def get_event_registrations_public_route(event_id: str):
    """Get public registration information for a specific event (aggregate data only)"""
    try:
        # Get basic event registration summary
        rsvp_data = await rsvp_list(event_id)
        seats_taken = rsvp_data.get('seats_taken', 0)
        total_spots = rsvp_data.get('spots', 0)
        
        # Handle unlimited spots (spots=0 or None) vs limited spots
        if total_spots == 0 or total_spots is None:
            available_spots = -1  # Indicate unlimited spots
        else:
            available_spots = max(0, total_spots - seats_taken)
        
        # Return ONLY aggregate information for unauthenticated users
        public_data = {
            "success": True,
            "total_registrations": seats_taken,
            "available_spots": available_spots,
            "total_spots": total_spots,
            "can_register": False  # Unauthenticated users cannot register
        }
        return public_data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching public event registrations: {str(e)}")


# Private Router
@private_event_router.get("/{event_id}/registrations/summary", response_model=dict)
async def get_event_registration_summary_route(event_id: str, request: Request):
    """Get registration summary for event (aggregate data only, no individual user information)"""
    try:
        user_uid = request.state.uid
        
        # Get basic event capacity information
        rsvp_data = await rsvp_list(event_id)
        seats_taken = rsvp_data.get('seats_taken', 0)
        total_spots = rsvp_data.get('spots', 0)
        
        # Handle unlimited spots (spots=0 or None) vs limited spots
        if total_spots == 0 or total_spots is None:
            available_spots = -1  # Indicate unlimited spots
        else:
            available_spots = max(0, total_spots - seats_taken)
        
        # Get current user's family registrations only
        attendees = rsvp_data.get('attendees', [])
        user_family_registrations = []
        
        for attendee in attendees:
            attendee_uid = attendee.get('user_uid')
            if attendee_uid == user_uid:
                # This is the current user or their family member
                user_name = await resolve_user_name(attendee_uid)
                person_id = attendee.get('person_id')
                person_name = None
                
                if person_id:
                    person_name = await resolve_family_member_name(attendee_uid, person_id)
                
                display_name = await create_display_name(attendee_uid, person_id, user_name, person_name)
                scope = attendee.get('scope', 'series')
                
                user_family_registrations.append({
                    "user_uid": attendee_uid,
                    "user_name": user_name,
                    "person_id": str(person_id) if person_id else None,
                    "person_name": person_name,
                    "display_name": display_name,
                    "registered_on": attendee.get('addedOn', datetime.now()),
                    "kind": attendee.get('kind', 'rsvp'),
                    "scope": scope,  # Include scope field
                    "payment_status": attendee.get('payment_status'),  # Include payment status
                    "payment_method": attendee.get('payment_method')   # Include payment method if available
                })
        
        return {
            "success": True,
            "user_registrations": user_family_registrations,  # Only current user's family
            "total_registrations": seats_taken,
            "available_spots": available_spots,
            "total_spots": total_spots,
            "can_register": available_spots > 0 or available_spots == -1  # Allow registration for unlimited spots
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching event registration summary: {str(e)}")


# Private Router
@private_event_router.post("/{event_id}/are-family-members-registered", response_model=dict)
async def check_family_members_registered_bulk_route(event_id: str, request: Request, family_member_data: Dict = Body(...)):
    """Check if multiple family members are registered for an event (bulk operation)"""
    try:
        family_member_ids = family_member_data.get('family_member_ids', [])
        if not family_member_ids:
            return {"success": True, "registrations": {}}
        
        # Get event registration data
        rsvp_data = await rsvp_list(event_id)
        attendees = rsvp_data.get('attendees', [])
        
        # Create a set of registered person_ids for efficient lookup
        registered_person_ids = set()
        for attendee in attendees:
            person_id = attendee.get('person_id')
            user_uid = attendee.get('user_uid')
            # Only include family members (person_id is not None) that belong to the current user
            if person_id and user_uid == request.state.uid:
                registered_person_ids.add(str(person_id))
        
        # Check each family member
        registrations = {}
        for family_member_id in family_member_ids:
            # Validate family member ownership
            member = await get_family_member_by_id(request.state.uid, family_member_id)
            if member:
                registrations[family_member_id] = family_member_id in registered_person_ids
            else:
                registrations[family_member_id] = False
        
        return {"success": True, "registrations": registrations}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error checking family member registrations: {str(e)}")


# Private Router
@private_event_router.get("/{event_id}/is-family-member-registered", response_model=dict)
async def check_family_member_registered_route(event_id: str, request: Request, family_member_id: str = Query(...)):
    """Check if a specific family member is registered for an event"""
    try:
        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        # Get event registration data
        rsvp_data = await rsvp_list(event_id)
        attendees = rsvp_data.get('attendees', [])
        
        # Check if this family member is registered
        is_registered = False
        for attendee in attendees:
            person_id = attendee.get('person_id')
            user_uid = attendee.get('user_uid')
            # Check if this attendee is the family member we're looking for
            if person_id and str(person_id) == family_member_id and user_uid == request.state.uid:
                is_registered = True
                break
        
        return {"success": True, "is_registered": is_registered}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error checking family member registration: {str(e)}")


# Public Router
@public_event_router.get("/{event_id}/is-registered/public", response_model=dict)
async def check_user_registered_public_route(event_id: str):
    """Check if the current user is registered for an event (public route for guests)"""
    try:
        # Unauthenticated users are not registered by definition
        return {"success": True, "is_registered": False}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error checking user registration: {str(e)}")

# Private Router
@private_event_router.get("/{event_id}/is-registered", response_model=dict)
async def check_user_registered_private_route(event_id: str, request: Request):
    """Check if the current user is registered for an event (authenticated route)"""
    try:
        user_uid = request.state.uid
        
        # Get event registration data
        rsvp_data = await rsvp_list(event_id)
        attendees = rsvp_data.get('attendees', [])
        
        # Check if current user is registered (person_id should be None for user registrations)
        is_registered = False
        for attendee in attendees:
            person_id = attendee.get('person_id')
            user_uid_in_attendee = attendee.get('user_uid')
            # Check if this attendee is the current user (not a family member)
            if person_id is None and user_uid_in_attendee == user_uid:
                is_registered = True
                break
        
        return {"success": True, "is_registered": is_registered}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error checking user registration: {str(e)}")
    
'''
