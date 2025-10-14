
from fastapi import APIRouter, HTTPException, status, Request, Body, Query, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models.event import sort_events, EventCreate, search_events, delete_events, get_event_by_id
from controllers.event_functions import process_create_event, process_edit_event, process_delete_event, register_rsvp, cancel_rsvp
from models.user import get_family_member_by_id
from models.event import rsvp_list
from typing import Literal, List, Dict
from bson import ObjectId
from typing import Optional
from datetime import date, datetime
from models.event import get_all_ministries


security = HTTPBearer(auto_error=False)




event_editing_router = APIRouter(prefix="/events", tags=["Events Editing Routes"])

public_event_router = APIRouter(prefix="/events", tags=["Events Public Routes"])

private_event_router = APIRouter(prefix="/events", tags=["Events Authenticated Routes"])


# Public Router
@public_event_router.get("/", summary="Get events by filters")
async def get_events(skip: int = 0, limit: int = 100, ministry: str = None, age: Optional[int] = None, gender: Optional[Literal["male", "female", "all"]] = None, is_free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"] = "date", name: Optional[str] = None, max_price: Optional[float] = None, date_after: Optional[date] = None, date_before: Optional[date] = None,):
    return await sort_events(skip, limit, ministry, age, gender, is_free, sort, sort_by, name=name, max_price=max_price, date_after=date_after, date_before=date_before)

# Public Router
@public_event_router.get("/search", summary="Search events")
async def search_events_route(query: str, skip: int = 0, limit: int = 100, ministry: str = None, age: Optional[int] = None, gender: Optional[Literal["male", "female", "all"]] = None, is_free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"] = "date"):
    return await search_events(query, skip, limit, ministry, age, gender, is_free, sort, sort_by)

# Public Router
@public_event_router.get("/upcoming", summary="Alias: Get upcoming events")
async def get_upcoming_events_alias(
    skip: int = 0,
    limit: int = 100,
    ministry: str = None,
    age: Optional[int] = None,
    gender: Literal["male", "female", "all"] = "all",
    is_free: bool = None,
    sort: Literal["asc", "desc"] = "asc",
    sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"] = "date",
    name: Optional[str] = None,
    max_price: Optional[float] = None,
    date_after: Optional[date] = None,
    date_before: Optional[date] = None,
):
    return await sort_events(skip, limit, ministry, age, gender, is_free, sort, sort_by, name=name, max_price=max_price, date_after=date_after, date_before=date_before)

# Public Router
@public_event_router.get("/ministries", summary="Get all unique ministries")
async def get_ministries_route():
    return await get_all_ministries()

# Public Router
@public_event_router.get("/{event_id}", summary="Get event by ID")
async def get_event_by_id_route(event_id: str):
    """Get a single event by its ID"""
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

# Private Router
@private_event_router.post("/{event_id}/rsvp")
async def rsvp_event(event_id: str, request: Request):
    ok = await register_rsvp(event_id, request.state.uid)
    if not ok:
        return {"success": False, "error": "Event full or already RSVP'd"}
    return {"success": True}

# Private Router
@private_event_router.delete("/{event_id}/rsvp")
async def unrsvp_event(event_id: str, request: Request):
    ok = await cancel_rsvp(event_id, request.state.uid)
    if not ok:
        return {"success": False, "error": "RSVP not found"}
    return {"success": True}

# Public Router
@public_event_router.get("/{event_id}/registrations/public", response_model=dict)
async def get_event_registrations_public_route(event_id: str):
    """Get public registration information for a specific event (aggregate data only)"""
    try:
        # Get basic event registration summary
        from models.event import rsvp_list
        rsvp_data = await rsvp_list(event_id)
        seats_taken = rsvp_data.get('seats_taken', 0)
        total_spots = rsvp_data.get('spots', 0)
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
        from models.event import rsvp_list
        rsvp_data = await rsvp_list(event_id)
        seats_taken = rsvp_data.get('seats_taken', 0)
        total_spots = rsvp_data.get('spots', 0)
        available_spots = max(0, total_spots - seats_taken)
        
        # Get current user's family registrations only
        attendees = rsvp_data.get('attendees', [])
        user_family_registrations = []
        
        for attendee in attendees:
            attendee_uid = attendee.get('user_uid')
            if attendee_uid == user_uid:
                # This is the current user or their family member
                from controllers.users_functions import resolve_user_name, resolve_family_member_name, create_display_name
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
                    "scope": scope  # Include scope field
                })
        
        return {
            "success": True,
            "user_registrations": user_family_registrations,  # Only current user's family
            "total_registrations": seats_taken,
            "available_spots": available_spots,
            "total_spots": total_spots,
            "can_register": available_spots > 0
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


# Perm Protected Router: event_editing
@event_editing_router.post("/", summary="Create event", status_code=status.HTTP_201_CREATED)
async def create_event_route(event: EventCreate, request: Request):
    return await process_create_event(event, request)

# Perm Protected Router: event_editing
@event_editing_router.put("/{event_id}", summary="Update event")
async def update_event_route(event_id: str, event: EventCreate, request: Request):
    return await process_edit_event(event_id, event, request)
    

# Perm Protected Router: event_editing
@event_editing_router.delete("/{event_id}", summary="Delete event")
async def delete_event_route(event_id: str, request: Request):
    return await process_delete_event(event_id, request)

# Perm Protected Router: event_editing
@event_editing_router.delete("/", summary="Delete multiple events by ID")
async def delete_events_route(event_ids: List[str], request: Request):
    """
    Deletes multiple events based on a list of provided string ObjectIds.
    """
    if not event_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No event IDs provided")
        
    try:
        # Convert string IDs to ObjectIds
        object_ids = [ObjectId(id_str) for id_str in event_ids]
    except Exception as e:
        # Handle potential errors if IDs are not valid ObjectIds
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ObjectId format provided in list: {e}")

    # Construct the filter query
    filter_query = {"_id": {"$in": object_ids}}
    
    # Call the model function with the correct filter
    deleted_count = await delete_events(filter_query)
    
    # Note: This endpoint currently returns success even if some/all IDs were not found.
    # You could add logic to check if deleted_count matches len(event_ids) if needed.
    # if deleted_count < len(event_ids):
    #     print(f"Warning: Requested deletion for {len(event_ids)} IDs, but only {deleted_count} were found and deleted.")

    return {"message": f"Attempted deletion for {len(event_ids)} IDs.", "deleted_count": deleted_count}


