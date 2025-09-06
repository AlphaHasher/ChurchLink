from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, Body, Depends
from helpers.Firebase_helpers import authenticate_uid

from backend.helpers.RouteParameterHelper import validate_route_ids, UserRouteHelper

public_event_person_router = APIRouter(prefix="/event-people", tags=["Event Registration"])
event_person_router = APIRouter(prefix="/event-people", tags=["Event People Management"])

#
# --- Protected routes --- 
#

# Update an event person registration's
@event_person_router.put("/{registration_id}", response_model=dict, summary="Modify event person registration")
async def modify_event_person(registration_id: str, update_data: dict = Body(...), uid: str = Depends(authenticate_uid)):
    try: 
        # TODO: validate update data and modify registration
        success = True 
        return {"success": success, "message": "Registration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error updating event person: {str(e)}")

# Delete an event person registration
@event_person_router.delete("/{registration_id}", response_model=dict, summary="Remove person from event")
async def remove_event_person(registration_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        # TODO: validate and delete registration
        success = True
        return {"success": success, "message": "Registration deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error deleting event person: {str(e)}")

# Get all events for a user
@event_person_router.get("/user/{user_id}", response_model=dict, summary="Get all events for a user")
async def get_user_events_route(user_id: str, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1), uid: str = Depends(authenticate_uid)):
    try: 
        # validate id's
        validate_route_ids(user_id=user_id, uid=uid)

        # TODO: get user events and summary from database
        events = []
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching user events: {str(e)}")

# Get specific event person registration
@event_person_router.get("/{registration_id}", response_model=dict, summary="Get specific event person registration")
async def get_event_person_route(registration_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        # TODO: get specific registration from database
        registration = None
        return {"success": True, "registration": registration}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching event person: {str(e)}")

@event_person_router.get("/status/{event_id}/{user_id}", response_model=dict, summary="Get registration status for event and user")
async def get_registration_status_route(event_id: str, user_id: str, family_member_id: Optional[str] = Query(None), uid: str = Depends(authenticate_uid)):
    try: 
        # validate id's
        validate_route_ids(user_id=user_id, family_member_id=family_member_id, uid=uid)

        # TODO: get registration status from database
        status_info = {}
        return {"success": True, "status": status_info}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching registration status: {str(e)}")
 
#
# --- Public routes --- 
#

# Add user to event
@public_event_person_router.post("/register/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED, summary="Register current user for an event")
async def register_user_for_event(event_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        # TODO: validate parameters and register user for event
        registration_data = None # Register user for event in database
        return {"success": True, "registration": registration_data}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error registering for event: {str(e)}")

# Remove user from event
@public_event_person_router.delete("/unregister/{event_id}", response_model=dict, summary="Unregister current user from an event")
async def unregister_user_from_event(event_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        # TODO: validate parameters and unregister user from event
        success = True 
        return {"success": success, "message": "Unregistered successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error unregistering from event: {str(e)}")

# Get user's events
@public_event_person_router.get("/my-events", response_model=dict, summary="Get current user's event registrations")
async def get_my_events(uid: str = Depends(authenticate_uid)):
    try: 
        # TODO: get user's events from database
        events = [] 
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching user events: {str(e)}")
   
# 
# --- Family Member Event Routes --- 
#

# Register a family member for an event
@public_event_person_router.post("/register/{event_id}/family-member/{family_member_id}", response_model=dict, status_code=status.HTTP_201_CREATED, summary="Register a family member for an event")
async def register_family_member_for_event(event_id: str, family_member_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        UserRouteHelper.validate_family_member_id(family_member_id)
        
        # TODO: validate parameters and register family member for event
        registration_data = None 
        return {"success": True, "registration": registration_data}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error registering family member for event: {str(e)}")

# Unregister a family member from an event
@public_event_person_router.delete("/unregister/{event_id}/family-member/{family_member_id}", response_model=dict, summary="Unregister a family member from an event")
async def unregister_family_member_from_event(event_id: str, family_member_id: str, uid: str = Depends(authenticate_uid)):
    try: 
        UserRouteHelper.validate_family_member_id(family_member_id)
        
        # TODO: validate parameters and unregister family member from event
        success = True 
        return {"success": success, "message": "Family member unregistered successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error unregistering family member from event: {str(e)}")

# Get all events for user's family members
@public_event_person_router.get("/my-family-members-events", response_model=dict, summary="Get all event registrations for user's family members")
async def get_my_family_members_events(uid: str = Depends(authenticate_uid)):
    try: 
        # TODO: get family member events from database
        events = [] 
        return {"success": True, "events": events}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error fetching family member events: {str(e)}")

