# backend/models/header.py
from typing import List, Optional
from pydantic import BaseModel
from mongo.database import DB
from bson.objectid import ObjectId

class HeaderLink(BaseModel):
    title: str
    url: str

class HeaderDropdown(BaseModel):
    title: str
    items: List[HeaderLink]

class HeaderItem(BaseModel):
    HeaderDropdown | HeaderLink

class Header(BaseModel):
    items: List[HeaderLink | HeaderDropdown]

# CRUD Operations

db_path = "header-items"

async def get_header() -> Optional[Header]:
    """
    Gets all header items from the database.
    Combines them into ordered array to be used for NavBar.
    """
    try:
        items_data = await DB.find_documents(db_path)
        if not items_data:
            return None

        # Convert the MongoDB documents into HeaderItem objects
        header_items = [None] * len(items_data)
        for i in range(len(items_data)):
            item = items_data[i]
            # Database type check

            if item["type"] == "dropdown":
                header_items[int(item["index"])] = HeaderDropdown(title=item["title"],items=item["items"])
            elif item["type"] == "link":
                header_items[int(item["index"])] = HeaderLink(title=item["title"],url=item["url"])

        # Create a Header object with the items
        return Header(items=header_items)
    except Exception as e:
        print(f"Error getting header items: {e}")
        return None

async def add_item(item: HeaderItem) -> bool:
    """
    Adds a new navigation item to the header.
    """
    try:
        result = await DB.insert_document(db_path, item.model_dump())
        return result.modified_count > 0
    except Exception as e:
        print(f"Error adding navigation item to header: {e}")
        return False

async def remove_item(item_title: str) -> bool:
    """
    Removes a navigation item from the header by title.
    """
    try:
        result = await DB.db["header"].update_one(
            {"_id": ObjectId(header_id)},
            {"$pull": {"items": {"title": item_title}}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error removing navigation item from header {header_id}: {e}")
        return False

async def reorder_items(items: List[HeaderItem]) -> bool:
    """
    Replaces the entire items array with a new order.
    """
    try:
        items_data = [item.model_dump() for item in items]
        result = await DB.db["header"].update_one(
            {"_id": ObjectId(header_id)},
            {"$set": {"items": items_data}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error reordering navigation items in header {header_id}: {e}")
        return False