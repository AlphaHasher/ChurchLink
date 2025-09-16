from typing import List, Optional
from fastapi import HTTPException, status, Request, Body
from bson import ObjectId
from pydantic import BaseModel

from protected_routers.auth_protected_router import AuthProtectedRouter
from models.user import get_family_member_by_id
from helpers.MongoHelper import serialize_objectid

event_person_router = AuthProtectedRouter(prefix="/event-people", tags=["Event People Management"])
# Additional router for frontend compatibility - handles /events/{event_id}/... routes
events_status_router = AuthProtectedRouter(prefix="/events", tags=["Event Status Routes"])

# Request model for bulk family member registration checking
class FamilyMembersRegistrationCheck(BaseModel):
    family_member_ids: List[str]

#
# --- Protected routes --- 
#

# Get all events for a user
@event_person_router.get("/user/{user_id}", response_model=dict)
async def get_user_events_route(user_id: str, request: Request):
    try:
        from mongo.churchuser import UserHandler
        from bson import ObjectId
        
        events = await UserHandler.list_my_events(user_id)
        # Convert ObjectIds to strings for JSON serialization
        events_serialized = serialize_objectid(events)
        
        return {"success": True, "events": events_serialized}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching user events: {str(e)}")

@event_person_router.get("/status/{event_id}/{user_id}", response_model=dict)
async def get_registration_status_route(event_id: str, user_id: str, request: Request):
    try:
        # Simple implementation using existing rsvp_list
        from models.event import rsvp_list
        
        rsvp_data = await rsvp_list(event_id)
        user_registered = any(r.get('user_uid') == user_id for r in rsvp_data.get('attendees', []))
        
        return {"success": True, "status": {"event_id": event_id, "user_id": user_id, "registered": user_registered}}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching registration status: {str(e)}")

# Check if family member is registered for an event - matches frontend expectation
@events_status_router.get("/{event_id}/is-family-member-registered", response_model=dict)
async def check_family_member_registration_status(event_id: str, request: Request, family_member_id: str):
    try:
        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        # Check registration status using existing rsvp_list
        from models.event import rsvp_list
        from bson import ObjectId
        
        rsvp_data = await rsvp_list(event_id)
        # Convert family_member_id to ObjectId for comparison
        family_member_object_id = ObjectId(family_member_id)
        is_registered = any(
            r.get('user_uid') == request.state.uid and r.get('person_id') == family_member_object_id
            for r in rsvp_data.get('attendees', [])
        )
        
        return {"success": True, "is_registered": is_registered, "event_id": event_id, "family_member_id": family_member_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error checking family member registration status: {str(e)}")

# Check if multiple family members are registered for an event - bulk endpoint for efficiency
@events_status_router.post("/{event_id}/are-family-members-registered", response_model=dict)
async def check_family_members_registration_status(event_id: str, request: Request, check_request: FamilyMembersRegistrationCheck = Body(...)):
    try:
        from models.event import rsvp_list
        from bson import ObjectId
        
        if not check_request.family_member_ids:
            return {"success": True, "registrations": {}, "event_id": event_id}
        
        # Validate all family member IDs belong to the requesting user
        for family_member_id in check_request.family_member_ids:
            member = await get_family_member_by_id(request.state.uid, family_member_id)
            if not member:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        # Get registration data once - much more efficient than multiple calls
        rsvp_data = await rsvp_list(event_id)
        attendees = rsvp_data.get('attendees', [])
        
        # Check registration status for all family members in a single pass
        registrations = {}
        for family_member_id in check_request.family_member_ids:
            family_member_object_id = ObjectId(family_member_id)
            is_registered = any(
                r.get('user_uid') == request.state.uid and r.get('person_id') == family_member_object_id
                for r in attendees
            )
            registrations[family_member_id] = is_registered
        
        return {"success": True, "registrations": registrations, "event_id": event_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error checking family members registration status: {str(e)}")

# Check if current user is registered for an event - for completeness
@events_status_router.get("/{event_id}/is-registered", response_model=dict)
async def check_user_registration_status(event_id: str, request: Request):
    try:
        # Check registration status using existing rsvp_list
        from models.event import rsvp_list
        
        rsvp_data = await rsvp_list(event_id)
        is_registered = any(r.get('user_uid') == request.state.uid for r in rsvp_data.get('attendees', []))
        
        return {"success": True, "is_registered": is_registered, "event_id": event_id, "user_id": request.state.uid}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error checking user registration status: {str(e)}")

# Get detailed registrations for an event - matches frontend expectation
@events_status_router.get("/{event_id}/registrations", response_model=dict)
async def get_event_registrations(event_id: str, request: Request):
    try:
        from controllers.users_functions import get_event_registration_summary
        
        # Get comprehensive registration summary
        registration_summary = await get_event_registration_summary(event_id)
        
        if not registration_summary.get('success', False):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=registration_summary.get('error', 'Failed to get registrations'))
        
        return registration_summary
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching event registrations: {str(e)}")

# Add user to event
@event_person_router.post("/register/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_user_for_event(event_id: str, request: Request):
    try:
        from controllers.event_functions import register_rsvp
        
        result = await register_rsvp(event_id, request.state.uid)
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed")
        
        return {"success": True, "registration": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error registering for event: {str(e)}")

# Remove user from event
@event_person_router.delete("/unregister/{event_id}", response_model=dict)
async def unregister_user_from_event(event_id: str, request: Request):
    try:
        from controllers.event_functions import cancel_rsvp
        
        result = await cancel_rsvp(event_id, request.state.uid)
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unregistration failed")
        
        return {"success": True, "message": "Unregistered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error unregistering from event: {str(e)}")

# Get user's events
@event_person_router.get("/my-events", response_model=dict)
async def get_my_events(request: Request, include_family: bool = True):
    try:
        from mongo.churchuser import UserHandler
        import json
        from bson import ObjectId
        import logging
        
        # Validate user ID is present
        if not request.state.uid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User authentication required")
        
        events = await UserHandler.list_my_events(request.state.uid)
        
        # Handle case where no events are found
        if events is None:
            events = []
        
        # Convert ObjectIds to strings for JSON serialization
        events_serialized = serialize_objectid(events)
        
        return {"success": True, "events": events_serialized}
    except HTTPException:
        raise
    except ValueError as e:
        logging.error(f"Invalid data format in user events for user {request.state.uid}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid data format in user events")
    except Exception as e:
        logging.error(f"Unexpected error fetching user events for user {request.state.uid}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while fetching user events")
   
# 
# --- Family Member Event Routes --- 
#

# Register a family member for an event
@event_person_router.post("/register/{event_id}/family-member/{family_member_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_family_member_for_event(event_id: str, family_member_id: str, request: Request):
    try:
        from controllers.event_functions import register_rsvp
        
        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        result = await register_rsvp(event_id, request.state.uid, family_member_id)
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed")
        
        return {"success": True, "registration": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error registering family member for event: {str(e)}")

# Unregister a family member from an event
@event_person_router.delete("/unregister/{event_id}/family-member/{family_member_id}", response_model=dict)
async def unregister_family_member_from_event(event_id: str, family_member_id: str, request: Request):
    try:
        from controllers.event_functions import cancel_rsvp
        
        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        result = await cancel_rsvp(event_id, request.state.uid, family_member_id)
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unregistration failed")
        
        return {"success": True, "message": "Family member unregistered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error unregistering family member from event: {str(e)}")

# Get all events for user's family members
@event_person_router.get("/my-family-members-events", response_model=dict)
async def get_my_family_members_events(request: Request, filters: Optional[str] = None):
    try:
        from mongo.churchuser import UserHandler
        
        # Get family member events - using existing UserHandler functionality
        events = await UserHandler.list_my_events(request.state.uid)
        # Filter for family member events specifically if needed
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family member events: {str(e)}")

# Get events for specific family member
@event_person_router.get("/family-member/{family_member_id}/events", response_model=dict)
async def get_family_member_events(family_member_id: str, request: Request):
    try:
        from mongo.churchuser import UserHandler
        import logging
        
        # Validate user ID is present
        if not request.state.uid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User authentication required")
        
        # Validate family member ID format
        try:
            family_member_object_id = ObjectId(family_member_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid family member ID format")
        
        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found or not owned by user")
        
        # Get events for specific family member
        events = await UserHandler.list_my_events(request.state.uid, person_id=family_member_object_id)
        
        # Handle case where no events are found
        if events is None:
            events = []
        
        events_serialized = serialize_objectid(events)
        
        return {"success": True, "events": events_serialized, "family_member_id": family_member_id}
    except HTTPException:
        raise
    except ValueError as e:
        logging.error(f"Invalid data format in family member events for user {request.state.uid}, family member {family_member_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid data format in family member events")
    except Exception as e:
        logging.error(f"Unexpected error fetching family member events for user {request.state.uid}, family member {family_member_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while fetching family member events")

