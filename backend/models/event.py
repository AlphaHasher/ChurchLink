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


# CRUD Operations
async def create_event(event: EventCreate) -> Optional[EventOut]:
    """
    Creates a new event using DB.insert_document.
    """
    try:
        # Use the helper method to insert
        inserted_id = await DB.insert_document("events", event.model_dump())
        if inserted_id:
            # Fetch the created event to return it as EventOut
            event_data = await DB.db["events"].find_one({"_id": inserted_id})
            if event_data:
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
        if event_doc:
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
    min_age: int = None,
    gender: Literal["male", "female", "all"] = "all",
    free: bool = None,
    sort: Literal["asc", "desc"] = "asc",
    sort_by: Literal[
        "date", "name", "location", "price", "ministry", "min_age", "gender", "free"
    ] = "date",
):
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
    min_age: int = None,
    gender: Literal["male", "female", "all"] = "all",
    free: bool = None,
    sort: Literal["asc", "desc"] = "asc",
    sort_by: Literal[
        "date", "name", "location", "price", "ministry", "min_age", "gender", "free"
    ] = "date",
):
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
        query["min_age"] = {
            "$gte": min_age
        }  # Filter events where event's min_age >= requested min_age

    if gender != "all":
        query["gender"] = gender
    if free is not None:
        query["free"] = free

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
    (Uses insert_one directly within the loop for clarity)
    Could potentially be optimized with insert_many if DB helper supported it.
    """
    fake = Faker()
    ministries = [
        "Youth",
        "Children",
        "Women",
        "Men",
        "Family",
        "Worship",
        "Outreach",
        "Bible Study",
    ]
    genders = ["male", "female", "all"]

    inserted_count = 0
    try:
        for _ in range(count):
            # Generate random date between now and 1 year from now
            start_date = datetime.now()
            end_date = datetime.now().replace(year=datetime.now().year + 1)
            random_date = fake.date_time_between(
                start_date=start_date, end_date=end_date
            )

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
                image_url=fake.image_url()
                if random.choice([True, False])
                else None,  # Add mock image URL
                thumbnail_url=fake.image_url(width=200, height=200)
                if random.choice([True, False])
                else None,  # Add mock thumbnail URL
                mock=True,
            )

            # Insert into database directly
            # Using insert_one here for simplicity within the loop
            # Could use DB.insert_document, but result handling is similar
            result = await DB.db["events"].insert_one(mock_event.model_dump())
            if result.inserted_id:
                inserted_count += 1

        print(
            f"Successfully created {inserted_count} mock events out of {count} requested."
        )
        return {"message": f"Successfully created {inserted_count} mock events"}
    except Exception as e:
        print(f"Error creating mock events: {e}")
        return {
            "message": f"Error creating mock events after {inserted_count} insertions."
        }
