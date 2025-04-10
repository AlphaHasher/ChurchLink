# Ministry selection
# Age Range
# Gender (Male/Female/Both)
# Free/Paid
# Search


from typing import Literal, Optional
from datetime import datetime
from mongo.database import DB
from pydantic import BaseModel, Field
from bson.objectid import ObjectId
from faker import Faker
import random

class Event(BaseModel):
    id: str
    name: str
    description: str
    date: datetime
    location: str
    price: str
    ministry: str
    min_age: int = Field(default=1, ge=1)
    gender: Literal["all", "male", "female"]
    free: bool
    image_url: Optional[str] = None  # Add optional image URL
    thumbnail_url: Optional[str] = None  # Add optional thumbnail URL
    mock: bool = False


class EventCreate(Event):
    pass

class EventOut(Event):
    id: str





# CRUD Operations examples
async def create_event(event: EventCreate):
    result = await DB.db["events"].insert_one(event.model_dump())
    event_data = await DB.db["events"].find_one({"_id": result.inserted_id})
    if event_data:
        event_data["id"] = str(event_data.pop("_id"))
        return EventOut(**event_data)
    return None

async def get_event_by_id(event_id: str):
    event = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
    if event:
        event["id"] = str(event.pop("_id"))
        return EventOut(**event)
    return None

async def update_event(event_id: str, event: EventCreate):
    result = await DB.db["events"].update_one({"_id": ObjectId(event_id)}, {"$set": event.model_dump()})
    return result.modified_count > 0

async def delete_event(event_id: str):
    result = await DB.db["events"].delete_one({"_id": ObjectId(event_id)})
    return result.deleted_count > 0


##search and filter function with sane defaults
async def search_events(query_text: str, skip: int = 0, limit: int = 100, ministry: str = None, min_age: int = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "gender", "free"] = "date"):
    query = {"$text": {"$search": query_text}}
    
    # Apply filters
    if ministry:
        query["ministry"] = ministry
    if min_age is not None:
        query["min_age"] = {"$gte": min_age}
    if gender != "all":
        query["gender"] = gender
    if free is not None:
        query["free"] = free
    
    # Get total count matching search and filters
    total = await DB.db["events"].count_documents(query)
    
    # Get events with sorting and pagination
    sort_direction = 1 if sort == "asc" else -1
    cursor = DB.db["events"].find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
    events = await cursor.to_list(length=limit)
    
    # Convert MongoDB documents to EventOut objects
    events_out = []
    for event in events:
        event["id"] = str(event.pop("_id"))
        events_out.append(EventOut(**event))
    return events_out

#sort and filter with limit no search
async def sort_events(skip: int = 0, limit: int = 100, ministry: str = None, min_age: int = None, gender: Literal["male", "female", "all"] = "all", free: bool = None, sort: Literal["asc", "desc"] = "asc", sort_by: Literal["date", "name", "location", "price", "ministry", "min_age", "gender", "free"] = "date"):
    """
    Get events with optional filters and sorting.
    
    Args:
        skip (int): Number of events to skip
        limit (int): Maximum number of events to return
        ministry (str): Filter by ministry
        min_age (int): Filter by minimum age
        gender (str): Filter by gender
        free (bool): Filter by free status
        sort (str): Sort direction ("asc" or "desc")
        sort_by (str): Field to sort by
        
    Returns:
        list: List of events matching the filters
    """
    query = {}
    
    # Apply filters
    if ministry:
        query["ministry"] = ministry

    # Apply age filters directly
    if min_age is not None:
        query["min_age"] = {"$gte": min_age} # Filter events where event's min_age >= requested min_age
            
    if gender != "all":
        query["gender"] = gender
    if free is not None:
        query["free"] = free
    
    # Get events with sorting
    sort_direction = 1 if sort == "asc" else -1
    cursor = DB.db["events"].find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
    events = await cursor.to_list(length=limit)
    
    # Convert MongoDB documents to EventOut objects
    events_out = []
    for event in events:
        event["id"] = str(event.pop("_id")) # Add 'id' field using the value from '_id', then remove '_id'
        events_out.append(EventOut(**event)) # Create EventOut by unpacking the modified dict
    return events_out



##get event amount
async def get_event_amount():
    return await DB.db["events"].count_documents({})


async def create_mock_events(count: int):
    """
    Create a specified number of mock events in the database.
    
    Args:
        count (int): Number of mock events to create
        
    Returns:
        dict: Success message with count of created events
    """
    fake = Faker()
    ministries = ["Youth", "Children", "Women", "Men", "Family", "Worship", "Outreach", "Bible Study"]
    genders = ["male", "female", "all"]
    
    for _ in range(count):
        # Generate random date between now and 1 year from now
        start_date = datetime.now()
        end_date = datetime.now().replace(year=datetime.now().year + 1)
        random_date = fake.date_time_between(start_date=start_date, end_date=end_date)
        
        # Generate random age range
        mock_min_age = random.randint(1, 18)
        
        # Create mock event
        mock_event = EventCreate(
            id=str(ObjectId()),
            name=fake.sentence(nb_words=4),
            description=fake.paragraph(nb_sentences=3),
            date=random_date,
            location=fake.address(),
            price=f"${random.randint(0, 100)}",
            ministry=random.choice(ministries),
            min_age=mock_min_age,
            gender=random.choice(genders),
            free=random.choice([True, False]),
            image_url=fake.image_url() if random.choice([True, False]) else None, # Add mock image URL
            thumbnail_url=fake.image_url(width=200, height=200) if random.choice([True, False]) else None, # Add mock thumbnail URL
            mock=True
        )
        
        # Insert into database
        await DB.db["events"].insert_one(mock_event.model_dump())
    
    return {"message": f"Successfully created {count} mock events"}



