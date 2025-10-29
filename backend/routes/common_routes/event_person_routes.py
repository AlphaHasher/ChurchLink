from typing import Optional
from fastapi import APIRouter, HTTPException, status, Request, Query
from bson import ObjectId

from models.user import get_family_member_by_id, get_family_members
from helpers.MongoHelper import serialize_objectid

event_person_registration_router = APIRouter(prefix="/event-people", tags=["Event Registration"])
event_person_management_router = APIRouter(prefix="/event-people", tags=["Event People Management"])

#
# --- Protected routes ---
#

# Private Router
# Add (watch) a non-RSVP event to "My Events"
@event_person_registration_router.post("/watch/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def watch_event_route(
    event_id: str,
    request: Request,
    scope: str = Query("series", regex="^(series|occurrence)$"),
    occurrenceStart: Optional[str] = Query(None, description="ISO8601 start for single occurrence"),
):
    """
    Adds an event to the user's 'My Events' as a 'watch' reference.
    scope=series|occurrence; when scope=occurrence you may pass occurrenceStart (ISO8601).
    """
    try:
        from mongo.churchuser import UserHandler
        from datetime import datetime

        ev_oid = ObjectId(event_id)
        occurrence_dt = None
        if scope == "occurrence" and occurrenceStart:
            try:
                occurrence_dt = datetime.fromisoformat(occurrenceStart)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid occurrenceStart; must be ISO8601")

        added = await UserHandler.add_to_my_events(
            uid=request.state.uid,
            event_id=ev_oid,
            reason="watch",
            scope=scope,
            occurrence_start=occurrence_dt,
        )
        if not added:
            # Already present or user not found
            return {"success": True, "added": False}
        return {"success": True, "added": True, "event": serialize_objectid(added)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error adding event to My Events: {str(e)}")


# Private Router
# Remove (unwatch) from "My Events"
@event_person_registration_router.delete("/watch/{event_id}", response_model=dict)
async def unwatch_event_route(
    event_id: str,
    request: Request,
    scope: Optional[str] = Query(None, regex="^(series|occurrence)$"),
    occurrenceStart: Optional[str] = Query(None),
):
    """
    Removes the user's 'watch' reference for this event.
    If scope/occurrenceStart are provided, removal will target that specific reference.
    Otherwise it removes any 'watch' entries for that event.
    """
    try:
        from mongo.churchuser import UserHandler
        from datetime import datetime

        ev_oid = ObjectId(event_id)
        occurrence_dt = None
        if occurrenceStart:
            try:
                occurrence_dt = datetime.fromisoformat(occurrenceStart)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid occurrenceStart; must be ISO8601")

        # Build a precise removal; only removes reason="watch"
        removed = await UserHandler.remove_from_my_events(
            uid=request.state.uid,
            event_id=ev_oid,
            reason="watch",
            scope=scope,
            occurrence_start=occurrence_dt,
        )
        return {"success": True, "removed": bool(removed)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error removing event from My Events: {str(e)}")


# Private Router
# Get all events for a user (My Events)
@event_person_management_router.get("/user", response_model=dict)
async def get_user_events_route(request: Request):
    try:
        from mongo.churchuser import UserHandler

        events = await UserHandler.list_my_events(request.state.uid)
        return {"success": True, "events": serialize_objectid(events)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching user events: {str(e)}")


# Private Router
@event_person_management_router.get("/status/{event_id}", response_model=dict)
async def get_registration_status_route(event_id: str, request: Request):
    """
    Simple check whether the *user themself* (not family) is registered for this event.
    Uses rsvp_list() which returns: { attendees: [...], seats_taken, spots }
    Each attendee has: user_uid, person_id, key, kind, addedOn, ...
    """
    try:
        from models.event import rsvp_list

        data = await rsvp_list(event_id)
        attendees = data.get("attendees", [])
        user_registered = any(a.get("user_uid") == request.state.uid and a.get("person_id") is None for a in attendees)

        return {
            "success": True,
            "status": {
                "event_id": event_id,
                "user_id": request.state.uid,
                "registered": user_registered
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching registration status: {str(e)}")


# Private Route
# Add user to event (RSVP/register)
@event_person_registration_router.post("/register/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_user_for_event(event_id: str, request: Request):
    try:
        from backend.controllers.event_controllers.admin_event_controller import register_rsvp

        # Get request body to extract payment option
        body = {}
        try:
            body = await request.json()
        except Exception:
            # No body or invalid JSON, use defaults
            pass
        
        payment_option = body.get("payment_option")

        result, reason = await register_rsvp(event_id, request.state.uid, payment_option=payment_option)
        if not result:
            raise HTTPException(status_code=400, detail=f"Registration failed: {reason}")
        return {"success": True, "registration": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error registering for event: {str(e)}")


# Private Route
# Remove user from event (cancel RSVP)
@event_person_registration_router.delete("/unregister/{event_id}", response_model=dict)
async def unregister_user_from_event(event_id: str, request: Request):
    try:
        from backend.controllers.event_controllers.admin_event_controller import cancel_rsvp

        result = await cancel_rsvp(event_id, request.state.uid)
        if not result:
            raise HTTPException(status_code=400, detail="Unregistration failed")
        return {"success": True, "message": "Unregistered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error unregistering from event: {str(e)}")


# Private Route
# Get user's events (alias of /user)
@event_person_registration_router.get("/my-events", response_model=dict)
async def get_my_events(request: Request, include_family: bool = True, expand: bool = False):
    try:
        from mongo.churchuser import UserHandler
        from bson import ObjectId
        import logging

        if not request.state.uid:
            raise HTTPException(status_code=401, detail="User authentication required")

        # Pass the expand parameter to the handler
        events = await UserHandler.list_my_events(request.state.uid, expand=expand)
        
        # If include_family is True, aggregate family member events
        if include_family:
            try:
                # Get user's family members
                family_members = await get_family_members(request.state.uid)
                
                # Fetch events for each family member
                for member in family_members:
                    member_id = member.id
                    if member_id:
                        person_oid = ObjectId(str(member_id))
                        family_events = await UserHandler.list_my_events(
                            request.state.uid, 
                            expand=expand, 
                            person_id=person_oid
                        )
                        events.extend(family_events)
            except Exception as e:
                logging.warning(f"Could not fetch family member events: {e}")
                # Continue without family events rather than failing completely
        
        # Deduplicate events based on unique key (event_id + person_id + kind + scope)
        # This prevents the same event registration from appearing multiple times
        # when family members overlap or user appears in multiple contexts
        unique_events = {}
        for event in events:
            key = event.get("key")
            if not key:
                # Build fallback composite key for events lacking a key
                parts = [
                    str(event.get("event_id") or event.get("_id") or ""),
                    str(event.get("person_id") or ""),
                    event.get("kind", "") or "",
                    event.get("scope", "") or "",
                ]
                key = "|".join(parts)
            if key and key not in unique_events:
                unique_events[key] = event
        
        deduped_events = list(unique_events.values())
        logging.info(f"[get_my_events] Original events: {len(events)}, After dedup: {len(deduped_events)}")
        
        return {"success": True, "events": serialize_objectid(deduped_events)}
    except HTTPException:
        raise
    except ValueError as e:
        import logging as _logging
        _logging.error(f"Invalid data format in user events for user {request.state.uid}: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid data format in user events")
    except Exception as e:
        import logging as _logging
        _logging.error(f"Unexpected error fetching user events for user {request.state.uid}: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching user events")


#
# --- Family Member Event Routes ---
#

# Private Route
# Register a family member for an event
@event_person_registration_router.post("/register/{event_id}/family-member/{family_member_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_family_member_for_event(event_id: str, family_member_id: str, request: Request):
    try:
        from backend.controllers.event_controllers.admin_event_controller import register_rsvp

        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Family member not found")

        # Get request body to extract payment option
        body = {}
        try:
            body = await request.json()
        except Exception:
            # No body or invalid JSON, use defaults
            pass
        
        payment_option = body.get("payment_option")

        result, reason = await register_rsvp(event_id, request.state.uid, family_member_id, payment_option=payment_option)
        if not result:
            raise HTTPException(status_code=400, detail=f"Registration failed: {reason}")

        return {"success": True, "registration": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error registering family member for event: {str(e)}")


# Private Route
# Unregister a family member from an event
@event_person_registration_router.delete("/unregister/{event_id}/family-member/{family_member_id}", response_model=dict)
async def unregister_family_member_from_event(event_id: str, family_member_id: str, request: Request):
    try:
        from backend.controllers.event_controllers.admin_event_controller import cancel_rsvp

        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Family member not found")

        result = await cancel_rsvp(event_id, request.state.uid, family_member_id)
        if not result:
            raise HTTPException(status_code=400, detail="Unregistration failed")

        return {"success": True, "message": "Family member unregistered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error unregistering family member from event: {str(e)}")


# Private Route
# Get all events for user's family members (currently returns all; filter if needed)
@event_person_registration_router.get("/my-family-members-events", response_model=dict)
async def get_my_family_members_events(request: Request, filters: Optional[str] = None):
    try:
        from mongo.churchuser import UserHandler
        events = await UserHandler.list_my_events(request.state.uid)
        return {"success": True, "events": serialize_objectid(events)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching family member events: {str(e)}")


# Private Route
# Get events for a specific family member
@event_person_registration_router.get("/family-member/{family_member_id}/events", response_model=dict)
async def get_family_member_events(family_member_id: str, request: Request):
    try:
        from mongo.churchuser import UserHandler
        import logging

        if not request.state.uid:
            raise HTTPException(status_code=401, detail="User authentication required")

        try:
            family_member_object_id = ObjectId(family_member_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid family member ID format")

        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Family member not found or not owned by user")

        # Filter by person_id
        events = await UserHandler.list_my_events(request.state.uid, person_id=family_member_object_id)
        return {
            "success": True,
            "events": serialize_objectid(events),
            "family_member_id": family_member_id
        }
    except HTTPException:
        raise
    except ValueError as e:
        logging.error(
            f"Invalid data format in family member events for user {request.state.uid}, family member {family_member_id}: {str(e)}"
        )
        raise HTTPException(status_code=400, detail="Invalid data format in family member events")
    except Exception as e:
        logging.error(
            f"Unexpected error fetching family member events for user {request.state.uid}, family member {family_member_id}: {str(e)}"
        )
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching family member events")


