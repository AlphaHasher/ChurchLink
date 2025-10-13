from typing import Optional
from fastapi import APIRouter, HTTPException, status, Request, Query, Body
from bson import ObjectId

from helpers.event_person_helper import event_person_helper
import logging


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
    return await event_person_helper.watch_event(
        event_id=event_id,
        user_uid=request.state.uid,
        scope=scope,
        occurrence_start=occurrenceStart
    )


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
    return await event_person_helper.unwatch_event(
        event_id=event_id,
        user_uid=request.state.uid,
        scope=scope,
        occurrence_start=occurrenceStart
    )


# Private Router
# Get all events for a user (My Events)
@event_person_management_router.get("/user", response_model=dict)
async def get_user_events_route(request: Request):
    return await event_person_helper.get_user_events(
        user_uid=request.state.uid
    )


# Private Router
@event_person_management_router.get("/status/{event_id}", response_model=dict)
async def get_registration_status_route(event_id: str, request: Request):
    """
    Simple check whether the *user themself* (not family) is registered for this event.
    Uses rsvp_list() which returns: { attendees: [...], seats_taken, spots }
    Each attendee has: user_uid, person_id, key, kind, addedOn, ...
    """
    return await event_person_helper.get_registration_status(
        event_id=event_id,
        user_uid=request.state.uid
    )


# Private Route
# Add user to event (RSVP/register)
@event_person_registration_router.post("/register/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_user_for_event(event_id: str, request: Request):
    return await event_person_helper.register_user_for_event(
        event_id=event_id,
        user_uid=request.state.uid
    )


# Private Route
# Remove user from event (cancel RSVP)
@event_person_registration_router.delete("/unregister/{event_id}", response_model=dict)
async def unregister_user_from_event(event_id: str, request: Request):
    return await event_person_helper.unregister_user_from_event(
        event_id=event_id,
        user_uid=request.state.uid
    )


# Private Route
# Get user's events (alias of /user)
@event_person_registration_router.get("/my-events", response_model=dict)
async def get_my_events(request: Request, include_family: bool = True, expand: bool = False):
    return await event_person_helper.get_user_events(
        user_uid=request.state.uid,
        expand=expand
    )


#
# --- Family Member Event Routes ---
#

# Private Route
# Register a family member for an event
@event_person_registration_router.post("/register/{event_id}/family-member/{family_member_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_family_member_for_event(event_id: str, family_member_id: str, request: Request):
    return await event_person_helper.register_family_member_for_event(
        event_id=event_id,
        family_member_id=family_member_id,
        user_uid=request.state.uid
    )


# Redundant donation endpoint removed - now using bulk payment system for all event donations
# Free events with donations should use: /events/{id}/payment/create-bulk-order

# Private Route
# Unregister a family member from an event
@event_person_registration_router.delete("/unregister/{event_id}/family-member/{family_member_id}", response_model=dict)
async def unregister_family_member_from_event(event_id: str, family_member_id: str, request: Request):
    return await event_person_helper.unregister_family_member_from_event(
        event_id=event_id,
        family_member_id=family_member_id,
        user_uid=request.state.uid
    )


# Private Route
# Get all events for user's family members (currently returns all; filter if needed)
@event_person_registration_router.get("/my-family-members-events", response_model=dict)
async def get_my_family_members_events(request: Request, filters: Optional[str] = None):
    return await event_person_helper.get_family_members_events(
        user_uid=request.state.uid,
        filters=filters
    )


# Private Route
# Get events for a specific family member
@event_person_registration_router.get("/family-member/{family_member_id}/events", response_model=dict)
async def get_family_member_events(family_member_id: str, request: Request):
    return await event_person_helper.get_family_member_events(
        family_member_id=family_member_id,
        user_uid=request.state.uid
    )


