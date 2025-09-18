from typing import Optional
from fastapi import APIRouter, HTTPException, status, Request
from bson import ObjectId

from models.user import get_family_member_by_id
from helpers.MongoHelper import serialize_objectid

event_person_registration_router = APIRouter(prefix="/event-people", tags=["Event Registration"])
event_person_management_router = APIRouter(prefix="/event-people", tags=["Event People Management"])

#
# --- Protected routes --- 
#

# Private Router
# Get all events for a user
@event_person_management_router.get("/user", response_model=dict)
async def get_user_events_route(request: Request):
    try:
        from mongo.churchuser import UserHandler
        from bson import ObjectId
        
        events = await UserHandler.list_my_events(request.state.uid)
        # Convert ObjectIds to strings for JSON serialization
        events_serialized = serialize_objectid(events)
        
        return {"success": True, "events": events_serialized}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching user events: {str(e)}")


# Private Router
@event_person_management_router.get("/status/{event_id}", response_model=dict)
async def get_registration_status_route(event_id: str, request: Request):
    try:
        # Simple implementation using existing rsvp_list
        from models.event import rsvp_list
        
        rsvp_data = await rsvp_list(event_id)
        user_registered = any(r.get('uid') == request.state.uid for r in rsvp_data.get('rsvp_list', []))
        
        return {"success": True, "status": {"event_id": event_id, "user_id": request.state.uid, "registered": user_registered}}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching registration status: {str(e)}")
 
# Private Route
# Add user to event
@event_person_registration_router.post("/register/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
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

# Private Route
# Remove user from event
@event_person_registration_router.delete("/unregister/{event_id}", response_model=dict)
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

# Private Route
# Get user's events
@event_person_registration_router.get("/my-events", response_model=dict)
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

# Private Route
# Register a family member for an event
@event_person_registration_router.post("/register/{event_id}/family-member/{family_member_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
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

# Private Route
# Unregister a family member from an event
@event_person_registration_router.delete("/unregister/{event_id}/family-member/{family_member_id}", response_model=dict)
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

# Private Route
# Get all events for user's family members
@event_person_registration_router.get("/my-family-members-events", response_model=dict)
async def get_my_family_members_events(request: Request, filters: Optional[str] = None):
    try:
        from mongo.churchuser import UserHandler
        
        # Get family member events - using existing UserHandler functionality
        events = await UserHandler.list_my_events(request.state.uid)
        # Filter for family member events specifically if needed
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family member events: {str(e)}")

# Private Route
# Get events for specific family member
@event_person_registration_router.get("/family-member/{family_member_id}/events", response_model=dict)
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

