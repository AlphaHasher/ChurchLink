from fastapi import APIRouter
from models.event import sort_events
from typing import Literal

event_router = APIRouter(prefix="/events")


@event_router.get("/", summary="Get all events")
async def get_events(skip: int = 0, limit: int = 100, ministry: str = None, age_range: tuple[int, int] = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "age_range", "gender", "free"] = "date"):
    return await sort_events(skip, limit, ministry, age_range, gender, free, sort, sort_by)



