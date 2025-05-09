
from fastapi import APIRouter, HTTPException, status, Depends
from models.event import sort_events, create_event, get_event_by_id, EventCreate, update_event, delete_event, search_events, delete_events, EventOut
from models.event_functions import process_create_event, process_edit_event, process_delete_event
from typing import Literal, List
from bson import ObjectId
from typing import Optional
from datetime import date
from helpers.Firebase_helpers import authenticate_uid


event_router = APIRouter(prefix="/events", tags=["Events"])
public_event_router = APIRouter(prefix="/events", tags=["Events Public Routes"])


@public_event_router.get("/", summary="Get events by filters")
async def get_events(skip: int = 0, limit: int = 100, ministry: str = None, age: Optional[int] = None, gender: Optional[Literal["male", "female", "all"]] = None, is_free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"] = "date", name: Optional[str] = None, max_price: Optional[float] = None, date_after: Optional[date] = None, date_before: Optional[date] = None,):
    return await sort_events(skip, limit, ministry, age, gender, is_free, sort, sort_by, name=name, max_price=max_price, date_after=date_after, date_before=date_before)


@public_event_router.get("/search", summary="Search events")
async def search_events_route(query: str, skip: int = 0, limit: int = 100, ministry: str = None, age: Optional[int] = None, gender: Optional[Literal["male", "female", "all"]] = None, is_free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"] = "date"):
    return await search_events(query, skip, limit, ministry, age, gender, is_free, sort, sort_by)

# This route catches all paths under /api/v1/events/...
# @public_event_router.get("/{event_id}", summary="Get event by id")
# async def get_event_by_id_route(event_id: str):
#     event = await get_event_by_id(event_id)
#     if not event:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
#     return event


@event_router.post("/", summary="Create event", status_code=status.HTTP_201_CREATED)
async def create_event_route(event: EventCreate, uid:str = Depends(authenticate_uid)):
    await process_create_event(event, uid)


@event_router.put("/{event_id}", summary="Update event")
async def update_event_route(event_id: str, event: EventCreate, uid:str = Depends(authenticate_uid)):
    await process_edit_event(event_id, event, uid)
    


@event_router.delete("/{event_id}", summary="Delete event")
async def delete_event_route(event_id: str, uid:str = Depends(authenticate_uid)):
    await process_delete_event(event_id, uid)

@event_router.delete("/", summary="Delete multiple events by ID")
async def delete_events_route(event_ids: List[str], uid:str = Depends(authenticate_uid)):
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

from models.event import get_all_ministries  # ensure this is imported

@public_event_router.get("/ministries", summary="Get all unique ministries")
async def get_ministries_route():
    return await get_all_ministries()

