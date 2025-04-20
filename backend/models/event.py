# Ministry selection
# Age Range
# Gender (Male/Female/Both)
# Free/Paid
# Search


from http.client import HTTPException
from typing import Literal, Optional, List
from datetime import datetime, time, timezone
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
    price: float
    spots: int
    rsvp: bool
    recurring: Literal["daily", "weekly", "monthly", "yearly", "never"]
    ministry: List[str]
    min_age: int = Field(default=1, ge=1)
    max_age: int = Field(default=100, ge=1)
    gender: Literal["all", "male", "female"]
    image_url: Optional[str] = None  # Add optional image URL
    thumbnail_url: Optional[str] = None  # Add optional thumbnail URL
    mock: bool = False


class EventCreate(BaseModel):
    name: str
    description: str
    date: datetime
    location: str
    price: float
    spots: int
    rsvp: bool
    recurring: Literal["daily", "weekly", "monthly", "yearly", "never"]
    ministry: List[str]
    min_age: int = Field(default=1, ge=1)
    max_age: int = Field(default=100, ge=1)
    gender: Literal["all", "male", "female"]
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    mock: bool = False


class EventOut(Event):
    id: str


# CRUD Operations
async def create_event(event: EventCreate) -> Optional[EventOut]:
    """
    Creates a new event using DB.insert_document.
    """
    try:
        # Use the helper method to insert
        inserted_id = await DB.insert_document("events", event.model_dump())
        if inserted_id is not None:
            # Fetch the created event to return it as EventOut
            event_data = await DB.db["events"].find_one({"_id": inserted_id})
            if event_data is not None:
                event_data["id"] = str(event_data.pop("_id"))
                return EventOut(**event_data)
        # Return None if insertion or fetching failed
        return None
    except Exception as e:
        print(f"An error occurred during event creation: {e}")
        return None


async def get_event_by_id(event_id: str) -> Optional[EventOut]:
    """
    Retrieves an event by its ID.
    (Uses find_one directly to target specific _id)
    """
    try:
        event_doc = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
        if event_doc is not None:
            event_doc["id"] = str(event_doc.pop("_id"))
            return EventOut(**event_doc)
        return None
    except Exception as e:
        print(f"Error fetching event by ID {event_id}: {e}")
        return None


async def update_event(event_id: str, event: EventCreate) -> bool:
    """
    Updates an event by its ID.
    (Uses update_one directly to target specific _id)
    """
    try:
        result = await DB.db["events"].update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": event.model_dump(exclude_unset=True)
            },  # exclude_unset for partial updates
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error updating event {event_id}: {e}")
        return False


async def delete_event(event_id: str) -> bool:
    """
    Deletes an event by its ID.
    (Uses delete_one directly to target specific _id)
    """
    try:
        result = await DB.db["events"].delete_one({"_id": ObjectId(event_id)})
        return result.deleted_count > 0
    except Exception as e:
        print(f"Error deleting event {event_id}: {e}")
        return False


async def delete_events(filter_query: dict) -> int:
    """
    Deletes multiple events matching the filter query using the DB.delete_documents helper.
    Returns the number of documents deleted.

    Args:
        filter_query (dict): The MongoDB filter query to select documents for deletion.

    Returns:
        int: The number of events deleted.
    """
    print(
        f"Attempting to delete events with filter: {filter_query}"
    )  # Log the filter being used
    deleted_count = await DB.delete_documents("events", filter_query)
    print(f"Deleted {deleted_count} events.")
    return deleted_count


##search and filter function with sane defaults
async def search_events(
    query_text: str,
    skip: int = 0,
    limit: int = 100,
    ministry: str = None,
    age: Optional[int] = None,
    gender: Literal["male", "female", "all"] = "all",
    is_free: Optional[bool] = None,
    sort: Literal["asc", "desc"] = "asc",
    sort_by: Literal[
        "date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"
    ] = "date",
):
    query = {"$text": {"$search": query_text}}

    # Apply filters
    if ministry:
        query["ministry"] = {"$in": [ministry]}
    
    age_filter = {}
    if age is not None:
        query["min_age"] = {"$lte": age}
        query["max_age"] = {"$gte": age}

    if gender != "all":
        query["gender"] = gender
    if is_free is not None:
        query["price"] = 0.0 if is_free else {"$gt": 0.0}

    # Get total count matching search and filters
    total = await DB.db["events"].count_documents(query)

    # Get events with sorting and pagination
    sort_direction = 1 if sort == "asc" else -1
    cursor = (
        DB.db["events"]
        .find(query)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(limit)
    )
    events = await cursor.to_list(length=limit)

    # Convert MongoDB documents to EventOut objects
    events_out = []
    for event in events:
        event["id"] = str(event.pop("_id"))
        events_out.append(EventOut(**event))
    return events_out


# sort and filter with limit no search
async def sort_events(
    skip: int = 0,
    limit: int = 100,
    ministry: str = None,
    age: Optional[int] = None,
    gender: Literal["male", "female", "all"] = "all",
    is_free: Optional[bool] = None,
    sort: Literal["asc", "desc"] = "asc",
    sort_by: Literal[
        "date", "name", "location", "price", "ministry", "min_age", "max_age", "gender"
    ] = "date",
    name: Optional[str] = None,
    max_price: Optional[float] = None,
    date_after: Optional[datetime] = None,
    date_before: Optional[datetime] = None,
):
    """
    Get events with optional filters and sorting.

    Args:
        skip (int): Number of events to skip
        limit (int): Maximum number of events to return
        ministry (str): Filter by ministry (must be in the event's list)
        min_age (int): Filter by minimum attendee age
        max_age (int): Filter by maximum attendee age
        gender (str): Filter by gender
        is_free (bool): Filter by free status (price == 0)
        sort (str): Sort direction ("asc" or "desc")
        sort_by (str): Field to sort by

    Returns:
        list: List of events matching the filters
    """
    query = {}

    # Apply filters
    if ministry:
        query["ministry"] = {"$in": [ministry]}

    if age is not None:
        query["min_age"] = {"$lte": age}
        query["max_age"] = {"$gte": age}

    if gender is not None:
        query["gender"] = gender

    if is_free is not None and is_free:
        # Only free events
        query["price"] = 0.0
    elif max_price is not None:
        # Paid events
        query["price"] = {"$lte": max_price}

    if name:
        query["name"] = {"$regex": name, "$options": "i"}  # Case-insensitive name search

    if date_after is not None:
        query.setdefault("date", {})
        query["date"]["$gte"] = datetime.combine(date_after, time.min)

    if date_before is not None:
        query.setdefault("date", {})
        query["date"]["$lte"] = datetime.combine(date_before, time.max)

    # Get events with sorting
    sort_direction = 1 if sort == "asc" else -1
    cursor = (
        DB.db["events"]
        .find(query)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(limit)
    )
    events = await cursor.to_list(length=limit)

    # Convert MongoDB documents to EventOut objects
    events_out = []
    for event in events:
        event["id"] = str(
            event.pop("_id")
        )  # Add 'id' field using the value from '_id', then remove '_id'
        events_out.append(
            EventOut(**event)
        )  # Create EventOut by unpacking the modified dict
    return events_out


##get event amount
async def get_event_amount() -> int:
    """Gets the total number of events in the collection."""
    try:
        # count_documents is a direct method, no specific helper for this
        count = await DB.db["events"].count_documents({})
        return count
    except Exception as e:
        print(f"Error counting events: {e}")
        return 0


async def create_mock_events(count: int) -> dict:
    """
    Create a specified number of mock events in the database.
    Uses the updated EventCreate model.
    """
    fake = Faker()
    ministries = [
        "Children",
        "Education",
        "Family",
        "Music",
        "Quo Vadis Theater",
        "Skala Teens",
        "VBS",
        "United Service",
        "Women's Ministries",
        "Youth"
    ]
    genders = ["male", "female", "all"]
    recurring_options = ["daily", "weekly", "monthly", "yearly", "never"]

    inserted_count = 0
    try:
        for _ in range(count):
            # Generate random date between now and 1 year from now
            start_date = datetime.now()
            end_date = datetime.now().replace(year=datetime.now().year + 1)
            random_date = fake.date_time_between(start_date=start_date, end_date=end_date).replace(tzinfo=None)

            # Generate random age range ensuring min_age <= max_age
            mock_min_age = random.randint(1, 80) # e.g. min age can be up to 80
            mock_max_age = random.randint(mock_min_age, 100) # max age is between min_age and 100

            # Decide if event is free or paid
            is_event_free = random.choice([True, False])
            mock_price = 0.0 if is_event_free else round(random.uniform(5.0, 150.0), 2)

            # Choose one or more ministries
            num_ministries = random.randint(1, 3)
            mock_ministries = random.sample(ministries, num_ministries)

            # Create mock event using EventCreate (no id)
            mock_event_data = EventCreate(
                name=fake.catch_phrase(), # Shorter, more event-like names
                description=fake.paragraph(nb_sentences=random.randint(2, 5)),
                date=random_date,
                location=fake.address(),
                price=mock_price, # Use float price
                spots=random.randint(10, 200), # Add spots
                rsvp=random.choice([True, False]), # Add rsvp
                recurring=random.choice(recurring_options), # Add recurring
                ministry=mock_ministries, # Use list of ministries
                min_age=mock_min_age,
                max_age=mock_max_age, # Add max_age
                gender=random.choice(genders),
                image_url=fake.image_url() if random.random() > 0.3 else None, # More likely to have image
                thumbnail_url=fake.image_url(width=200, height=200) if random.random() > 0.5 else None, # More likely to have thumbnail
                mock=True, # Mark as mock
            )

            # Insert into database using the model function's internal logic
            # This uses DB.insert_document helper implicitly now via create_event, if we used it
            # Or insert directly as before:
            result = await DB.db["events"].insert_one(mock_event_data.model_dump())
            if result.inserted_id is not None:
                inserted_count += 1

        print(f"Successfully created {inserted_count} mock events out of {count} requested.")
        return {"message": f"Successfully created {inserted_count} mock events"}
    except Exception as e:
        print(f"Error creating mock events: {e}")
        # Log the exception traceback for detailed debugging if needed
        import traceback
        traceback.print_exc()
        return {"message": f"Error creating mock events after {inserted_count} insertions."}

async def get_all_ministries():
    if DB.db is None:
        raise HTTPException(status_code=500, detail="Database not initialized.")
    try:
        ministries_cursor = DB.db["events"].aggregate([
            {"$unwind": {"path": "$ministry", "preserveNullAndEmptyArrays": False}},
            {"$group": {"_id": "$ministry"}},
            {"$sort": {"_id": 1}}
        ])
        ministries = await ministries_cursor.to_list(length=100)
        return [m["_id"] for m in ministries]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to fetch ministries", "reason": str(e)}
        )