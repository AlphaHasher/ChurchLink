from fastapi import APIRouter
from models.event import sort_events, create_event, get_event_by_id, EventCreate, update_event, delete_event, search_events, create_mock_events
from typing import Literal

event_router = APIRouter(prefix="/events", tags=["Events"])


@event_router.get("/", summary="Get events by filters")
async def get_events(skip: int = 0, limit: int = 100, ministry: str = None, min_age: int = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "gender", "free"] = "date"):
    return await sort_events(skip, limit, ministry, min_age, gender, free, sort, sort_by)


@event_router.get("/search", summary="Search events")
async def search_events_route(query: str, skip: int = 0, limit: int = 100, ministry: str = None, min_age: int = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "gender", "free"] = "date"):
    return await search_events(query, skip, limit, ministry, min_age, gender, free, sort, sort_by)


@event_router.get("/{event_id}", summary="Get event by id")
async def get_event_by_id_route(event_id: str):
    return await get_event_by_id(event_id)


@event_router.post("/", summary="Create event")
async def create_event_route(event: EventCreate):
    return await create_event(event)


@event_router.put("/{event_id}", summary="Update event")
async def update_event_route(event_id: str, event: EventCreate):
    return await update_event(event_id, event)


@event_router.delete("/{event_id}", summary="Delete event")
async def delete_event_route(event_id: str):
    return await delete_event(event_id)


@event_router.post("/mock", summary="Create mock events")
async def create_mock_events_route(count: int = 10):
    return await create_mock_events(count)











