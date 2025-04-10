# Ministry selection
# Age Range
# Gender (Male/Female/Both)
# Free/Paid
# Search


from typing import Literal
from datetime import datetime
from mongo.database import DB
from pydantic import BaseModel
from bson.objectid import ObjectId
class Event(BaseModel):
    id: str
    name: str
    description: str
    date: datetime
    location: str
    price: str
    ministry: str
    age_range: tuple[int, int] = (1, 100)  # min age 1, max age 100
    gender: Literal["all", "male", "female"]
    free: bool


class EventCreate(Event):
    pass

class EventOut(Event):
    id: str





# CRUD Operations examples
async def create_event(event: EventCreate):
    result = await DB.db["events"].insert_one(event.model_dump())
    event_data = await DB.db["events"].find_one({"_id": result.inserted_id})
    return EventOut(id=str(event_data["_id"]), **event_data)

async def get_event_by_id(event_id: str):
    event = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
    if event:
        return EventOut(id=str(event["_id"]), **event)
    return None

async def update_event(event_id: str, event: EventCreate):
    result = await DB.db["events"].update_one({"_id": ObjectId(event_id)}, {"$set": event.model_dump()})
    return result.modified_count > 0

async def delete_event(event_id: str):
    result = await DB.db["events"].delete_one({"_id": ObjectId(event_id)})
    return result.deleted_count > 0


##search and filter function with sane defaults
async def search_events(query: str, skip: int = 0, limit: int = 100, ministry: str = None, age_range: tuple[int, int] = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "age_range", "gender", "free"] = "date"):
    query = {"$text": {"$search": query}}
    if ministry:
        query["ministry"] = ministry
    if age_range:
        query["age_range"] = age_range
    if gender:
        query["gender"] = gender
    if free:
        query["free"] = free
    if skip:
        query["$skip"] = skip
    if limit:
        query["$limit"] = limit
    if sort:
        query["$sort"] = sort
    if sort_by:
        query["$sort"] = {sort_by: 1 if sort == "asc" else -1}
    events = await DB.db["events"].find(query).skip(skip).limit(limit)
    return [EventOut(id=str(event["_id"]), **event) for event in events]

#sort and filter with limit no search
async def sort_events(skip: int = 0, limit: int = 100, ministry: str = None, age_range: tuple[int, int] = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "age_range", "gender", "free"] = "date"):
    query = {}
    if ministry:
        query["ministry"] = ministry
    if age_range:
        query["age_range"] = age_range
    if gender:
        query["gender"] = gender
    if free:
        query["free"] = free
    if skip:
        query["$skip"] = skip
    if limit:
        query["$limit"] = limit
    if sort:
        query["$sort"] = sort
    if sort_by:
        query["$sort"] = {sort_by: 1 if sort == "asc" else -1}
    events = await DB.db["events"].find(query).skip(skip).limit(limit)
    return [EventOut(id=str(event["_id"]), **event) for event in events]



##get event amount
async def get_event_amount():
    return await DB.db["events"].count_documents({})



