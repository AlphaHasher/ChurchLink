from fastapi import APIRouter, Query, Request
from typing import Optional, List
from datetime import datetime
from models.event_instance import search_upcoming_event_instances_for_read
from controllers.event_controllers.user_event_controller import process_add_favorite_event, process_remove_favorite_event


public_event_router = APIRouter(prefix="/events", tags=["Events Public Routes"])

private_event_router = APIRouter(prefix="/events", tags=["Events Authenticated Routes"])


@public_event_router.get("/upcoming-public", summary="Fetch upcoming event instances for users")
async def get_upcoming_events_for_users(
    limit: int = Query(20, ge=1, le=100),
    min_age: Optional[int] = Query(None, ge=0),
    max_age: Optional[int] = Query(None, ge=0),
    gender: Optional[str] = Query(None),  # 'all'|'male'|'female'|'male_only'|'female_only'|None
    ministries: Optional[List[str]] = Query(None, description="Repeated or comma-separated"),
    unique_only: bool = Query(False),
    preferred_lang: Optional[str] = Query("en"),
    cursor_scheduled_date: Optional[datetime] = Query(None),
    cursor_id: Optional[str] = Query(None),
    favorites_only: bool = Query(False, description="Return only favorited events (ignored for public)"),
    members_only_only: bool = Query(False, description="Return only members-only events"),
    max_price: Optional[float] = Query(None, ge=0),
):
    mins = ministries or None
    if mins and len(mins) == 1 and ("," in mins[0]):
        mins = [s.strip() for s in mins[0].split(",") if s.strip()]

    return await search_upcoming_event_instances_for_read(
        limit=limit,
        min_age=min_age,
        max_age=max_age,
        gender=gender,
        ministries=mins,
        unique_only=unique_only,
        uid=None,
        preferred_lang=preferred_lang,
        cursor_scheduled_date=cursor_scheduled_date,
        cursor_id=cursor_id,
        favorites_event_ids=None,
        favorites_only=favorites_only,
        members_only_only=members_only_only,
        max_price=max_price,
    )

@private_event_router.get("/upcoming-private", summary="Fetch upcoming event instances for authenticated users")
async def get_upcoming_events_for_authenticated_users(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    min_age: Optional[int] = Query(None, ge=0),
    max_age: Optional[int] = Query(None, ge=0),
    gender: Optional[str] = Query(None),  # 'all'|'male'|'female'|'male_only'|'female_only'|None
    ministries: Optional[List[str]] = Query(None, description="Repeated or comma-separated"),
    unique_only: bool = Query(False),
    preferred_lang: Optional[str] = Query("en"),
    cursor_scheduled_date: Optional[datetime] = Query(None),
    cursor_id: Optional[str] = Query(None),
    favorites_only: bool = Query(False),
    members_only_only: bool = Query(False),
    max_price: Optional[float] = Query(None, ge=0),
):
    mins = ministries or None
    if mins and len(mins) == 1 and ("," in mins[0]):
        mins = [s.strip() for s in mins[0].split(",") if s.strip()]

    favs = (getattr(request.state, "user", {}) or {}).get("favorite_events") or []

    return await search_upcoming_event_instances_for_read(
        limit=limit,
        min_age=min_age,
        max_age=max_age,
        gender=gender,
        ministries=mins,
        unique_only=unique_only,
        uid=request.state.uid,
        preferred_lang=preferred_lang,
        cursor_scheduled_date=cursor_scheduled_date,
        cursor_id=cursor_id,
        favorites_event_ids=favs,
        favorites_only=favorites_only,
        members_only_only=members_only_only,
        max_price=max_price,
    )

@private_event_router.put("/add-favorite/{event_id}")
async def add_favorite_event(request: Request, event_id: str):
    return await process_add_favorite_event(request, event_id)

@private_event_router.put("/remove-favorite/{event_id}")
async def remove_favorite_event(request: Request, event_id: str):
    return await process_remove_favorite_event(request, event_id)