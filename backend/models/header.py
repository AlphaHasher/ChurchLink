# backend/models/header.py
from datetime import datetime
from typing import List, Optional, Literal, Final, Union
from pydantic import BaseModel
from mongo.database import DB

class HeaderLink(BaseModel):
    title: str
    url: str
    type: Final[str] = "link"
    visible: Optional[bool] = True

class HeaderDropdown(BaseModel):
    title: str
    items: List[HeaderLink]
    type: Final[str] = "dropdown"
    visible: Optional[bool] = True

# Define HeaderItem as a Union type
HeaderItem = Union[HeaderLink, HeaderDropdown]

class Header(BaseModel):
    items: List[HeaderItem]

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
        header_items = list()
        for i in range(len(items_data)):
            item = items_data[i]
            # Database type check
            if type(item) != "int" and item.get("visible", True):
                if item["type"] == "dropdown":
                    header_items.append(HeaderDropdown(
                        title=item["title"],
                        items=item["items"]
                    ))
                elif item["type"] == "link":
                    header_items.append(HeaderLink(
                        title=item["title"],
                        url=item["url"]
                    ))

        # Create a Header object with the items
        return Header(items=header_items)
    except Exception as e:
        print(f"Error getting header items: {e}")
        return None

async def get_item_by_title(title: str) -> Optional[Union[HeaderLink, HeaderDropdown]]:
    """
    Gets a header item by its title.
    Returns the item as either HeaderLink or HeaderDropdown based on its type.
    """
    try:
        items = await DB.find_documents(db_path, {"title": title})
        item = items[0] if items else None

        if not item:
            return None

        # Convert the MongoDB document into the appropriate HeaderItem type
        if item.get("visible", True):
            if item["type"] == "dropdown":
                return HeaderDropdown(title=item["title"], items=item["items"])
            elif item["type"] == "link":
                return HeaderLink(title=item["title"], url=item["url"])

        return None
    except Exception as e:
        print(f"Error getting header item by title: {e}")
        return None

async def get_item_by_index(index: int) -> Optional[Union[HeaderLink, HeaderDropdown]]:
    """
    Gets a header item by its index.
    Returns the item as either HeaderLink or HeaderDropdown based on its type.
    """
    try:
        item = await DB.find_one_document(db_path, {"index": index})
        if not item:
            return None

        # Convert the MongoDB document into the appropriate HeaderItem type
        if item["type"] == "dropdown":
            return HeaderDropdown(title=item["title"], items=item["items"], visible=item.get("visible", True))
        elif item["type"] == "link":
            return HeaderLink(title=item["title"], url=item["url"], visible=item.get("visible", True))
        return None
    except Exception as e:
        print(f"Error getting header item by index: {e}")
        return None

async def add_link(item: dict) -> bool:
    """
    Adds a new navigation item to the header.
    """
    try:
        item_input = item
        item_input["type"] = "link"
        item_input["index"] = len(await DB.find_documents(db_path, {}))
        item_input["updated_at"] = datetime.utcnow()
        res = await DB.insert_document(db_path, item_input)
        return res is not None
    except Exception as e:
        print(f"Error adding navigation item to header: {e}")
        return False

async def add_dropdown(item: dict) -> bool:
    """
    Adds a new dropdown navigation item to the header.
    """
    try:
        res = await DB.insert_document(db_path, {
            "title": item["title"],
            "items": [
                {
                    "title": subitem.title,
                    "url": subitem.url
                } for subitem in item["items"]
            ],
            "visible": item.get("visible", True),
            "type": "dropdown",
            "index": len(await DB.find_documents(db_path, {})),
            "updated_at": datetime.utcnow()
        })
        return res is not None
    except Exception as e:
        print(f"Error adding dropdown navigation item to header: {e}")
        return False

async def remove_item_by_name(title: str) -> bool:
    """
    Removes a header item by its title.
    """
    try:
        result = await DB.delete_documents(db_path, {"title": title})
        return result > 0  # Return True if at least one document was deleted
    except Exception as e:
        print(f"Error removing header item: {e}")
        return False