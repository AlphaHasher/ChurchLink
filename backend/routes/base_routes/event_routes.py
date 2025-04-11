
from fastapi import APIRouter, HTTPException, status
from models.event import sort_events, create_event, get_event_by_id, EventCreate, update_event, delete_event, search_events, create_mock_events, delete_events, EventOut
from typing import Literal, List
from bson import ObjectId


event_router = APIRouter(prefix="/events", tags=["Events"])


@event_router.get("/", summary="Get events by filters")
async def get_events(skip: int = 0, limit: int = 100, ministry: str = None, min_age: int = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "gender", "free"] = "date"):
    return await sort_events(skip, limit, ministry, min_age, gender, free, sort, sort_by)


@event_router.get("/search", summary="Search events")
async def search_events_route(query: str, skip: int = 0, limit: int = 100, ministry: str = None, min_age: int = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "gender", "free"] = "date"):
    return await search_events(query, skip, limit, ministry, min_age, gender, free, sort, sort_by)


@event_router.get("/{event_id}", summary="Get event by id")
async def get_event_by_id_route(event_id: str):
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@event_router.post("/", summary="Create event", status_code=status.HTTP_201_CREATED)
async def create_event_route(event: EventCreate):
    created_event = await create_event(event)
    if not created_event:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event (maybe duplicate name/data?)")
    return created_event


@event_router.put("/{event_id}", summary="Update event")
async def update_event_route(event_id: str, event: EventCreate):
    success = await update_event(event_id, event)
    if not success:
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found or update failed")
    return {"message": "Event updated successfully", "success": True}


@event_router.delete("/{event_id}", summary="Delete event")
async def delete_event_route(event_id: str):
    success = await delete_event(event_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return {"message": "Event deleted successfully", "success": True}

@event_router.delete("/", summary="Delete multiple events by ID")
async def delete_events_route(event_ids: List[str]):
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

@event_router.post("/mock", summary="Create mock events")
async def create_mock_events_route(count: int = 10):
    return await create_mock_events(count)











