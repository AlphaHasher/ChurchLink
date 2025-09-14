from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, Body, Depends, Request
from bson import ObjectId

from protected_routers.auth_protected_router import AuthProtectedRouter
from models.user import get_family_member_by_id
from helpers.MongoHelper import serialize_objectid

public_event_person_router = AuthProtectedRouter(prefix="/event-people", tags=["Event Registration"])
event_person_router = AuthProtectedRouter(prefix="/event-people", tags=["Event People Management"])

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
        
        rsvp_data = await rsvp_list(ObjectId(event_id))
        user_registered = any(r.get('uid') == user_id for r in rsvp_data.get('rsvp_list', []))
        
        return {"success": True, "status": {"event_id": event_id, "user_id": user_id, "registered": user_registered}}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching registration status: {str(e)}")
 
#
# --- Public routes --- 
#

# Add user to event
@public_event_person_router.post("/register/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_user_for_event(event_id: str, request: Request):
    try:
        from controllers.event_functions import register_rsvp
        
        result = await register_rsvp(ObjectId(event_id), request.state.uid)
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed")
        
        return {"success": True, "registration": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error registering for event: {str(e)}")

# Remove user from event
@public_event_person_router.delete("/unregister/{event_id}", response_model=dict)
async def unregister_user_from_event(event_id: str, request: Request):
    try:
        from controllers.event_functions import cancel_rsvp
        
        result = await cancel_rsvp(ObjectId(event_id), request.state.uid)
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unregistration failed")
        
        return {"success": True, "message": "Unregistered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error unregistering from event: {str(e)}")

# Get user's events
@public_event_person_router.get("/my-events", response_model=dict)
async def get_my_events(request: Request, include_family: bool = True):
    try:
        from mongo.churchuser import UserHandler
        import json
        from bson import ObjectId
        
        events = await UserHandler.list_my_events(request.state.uid)
        # Convert ObjectIds to strings for JSON serialization
        events_serialized = serialize_objectid(events)
        
        return {"success": True, "events": events_serialized}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching user events: {str(e)}")
   
# 
# --- Family Member Event Routes --- 
#

# Register a family member for an event
@public_event_person_router.post("/register/{event_id}/family-member/{family_member_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_family_member_for_event(event_id: str, family_member_id: str, request: Request):
    try:
        from controllers.event_functions import register_rsvp
        
        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        result = await register_rsvp(ObjectId(event_id), request.state.uid, ObjectId(family_member_id))
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed")
        
        return {"success": True, "registration": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error registering family member for event: {str(e)}")

# Unregister a family member from an event
@public_event_person_router.delete("/unregister/{event_id}/family-member/{family_member_id}", response_model=dict)
async def unregister_family_member_from_event(event_id: str, family_member_id: str, request: Request):
    try:
        from controllers.event_functions import cancel_rsvp
        
        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")
        
        result = await cancel_rsvp(ObjectId(event_id), request.state.uid, ObjectId(family_member_id))
        if not result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unregistration failed")
        
        return {"success": True, "message": "Family member unregistered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error unregistering family member from event: {str(e)}")

# Get all events for user's family members
@public_event_person_router.get("/my-family-members-events", response_model=dict)
async def get_my_family_members_events(request: Request, filters: Optional[str] = None):
    try:
        from mongo.churchuser import UserHandler
        
        # Get family member events - using existing UserHandler functionality
        events = await UserHandler.list_my_events(request.state.uid)
        # Filter for family member events specifically if needed
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family member events: {str(e)}")

