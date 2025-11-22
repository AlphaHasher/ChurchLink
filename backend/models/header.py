from datetime import datetime
from typing import List, Optional, Final, Union, Dict
from pydantic import BaseModel
from mongo.database import DB
from typing import ClassVar

class HeaderLink(BaseModel):
    titles: Dict[str, str]
    url: Optional[str] = None  # For backward compatibility and hardcoded URLs
    slug: Optional[str] = None  # For linking to pages by slug
    is_hardcoded_url: bool = False  # Flag to indicate if URL is hardcoded or should use slug navigation
    type: ClassVar[str] = "link"
    visible: Optional[bool] = True

class HeaderDropdown(BaseModel):
    titles: Dict[str, str]
    items: List[HeaderLink]
    type: ClassVar[str] = "dropdown"
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
        header_items = [None] * len(items_data) # Make a full list to capture indexes
        for i in range(len(items_data)):
            item = items_data[i]
            if type(item) != "int" and item.get("visible", True):
                if item["type"] == "dropdown":
                    header_items[item["index"]] = HeaderDropdown(
                        titles=item.get("titles") or {},
                        items=item["items"],
                        visible=item["visible"]
                    )
                elif item["type"] == "link":
                    header_items[item["index"]] = HeaderLink(
                        titles=item.get("titles") or {},
                        url=item.get("url"),
                        slug=item.get("slug"),
                        is_hardcoded_url=item.get("is_hardcoded_url", False),
                        visible=item["visible"]
                    )

        # Create a Header object with the items
        public_header = [i for i in header_items if i is not None]
        return Header(items=public_header)
    except Exception as e:
        print(f"Error getting header items: {e}")
        return None

async def get_header_items() -> Optional[Header]:
    """
    Gets all header items from the database.
    Combines them into ordered array to be used for NavBar.
    """
    try:
        items_data = await DB.find_documents(db_path)
        if not items_data:
            return None

        # Convert the MongoDB documents into HeaderItem objects
        header_items = [None] * len(items_data) # Make a full list to capture indexes
        for i in range(len(items_data)):
            item = items_data[i]
            if item["type"] == "dropdown":
                header_items[item["index"]] = HeaderDropdown(
                    titles=item.get("titles") or {},
                    items=item["items"],
                    visible=item["visible"]
                )
            elif item["type"] == "link":
                header_items[item["index"]] = HeaderLink(
                    titles=item.get("titles") or {},
                    url=item.get("url"),
                    slug=item.get("slug"),
                    is_hardcoded_url=item.get("is_hardcoded_url", False),
                    visible=item["visible"]
                )

        # Collapse list to remove hidden items
        public_header = [i for i in header_items if i is not None]
        return Header(items=public_header)
    except Exception as e:
        print(f"Error getting header items: {e}")
        return None

async def get_item_by_title(title: str) -> Optional[Union[HeaderLink, HeaderDropdown]]:
    """
    Gets a header item by its title.
    Returns the item as either HeaderLink or HeaderDropdown based on its type.
    """
    try:
        items = await DB.find_documents(db_path, {"titles.en": title})
        item = items[0] if items else None

        if not item:
            return None

        # Convert the MongoDB document into the appropriate HeaderItem type
        if item["type"] == "dropdown":
            return HeaderDropdown(titles=item.get("titles") or {}, items=item["items"])
        elif item["type"] == "link":
            return HeaderLink(titles=item.get("titles") or {}, url=item.get("url"), slug=item.get("slug"), is_hardcoded_url=item.get("is_hardcoded_url", False))

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
            return HeaderDropdown(titles=item.get("titles") or {}, items=item["items"], visible=item.get("visible", True))
        elif item["type"] == "link":
            return HeaderLink(titles=item.get("titles") or {}, url=item.get("url"), slug=item.get("slug"), is_hardcoded_url=item.get("is_hardcoded_url", False), visible=item.get("visible", True))
        return None
    except Exception as e:
        print(f"Error getting header item by index: {e}")
        return None

async def add_link(item: dict) -> bool:
    """
    Adds a new navigation item to the header.
    """
    try:
        item_input = {
            "titles": item.get("titles") or {},
            "type": "link",
            "index": len(await DB.find_documents(db_path, {})),
            "visible": item.get("visible", True),
            "updated_at": datetime.utcnow()
        }

        # Handle slug vs hardcoded URL
        if item.get("is_hardcoded_url", False):
            item_input["url"] = item.get("url", "")
            item_input["is_hardcoded_url"] = True
        else:
            item_input["slug"] = item.get("slug", "")
            item_input["is_hardcoded_url"] = False

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
        # Process dropdown items to handle slug vs hardcoded URL
        processed_items = []
        for subitem in item["items"]:
            processed_item = {
                "titles": subitem.get("titles") or {},
                "visible": bool(subitem.get("visible", True))
            }

            # Handle slug vs hardcoded URL for dropdown items
            if bool(subitem.get("is_hardcoded_url", False)):
                processed_item["url"] = subitem.get("url", "")
                processed_item["is_hardcoded_url"] = True
            else:
                processed_item["slug"] = subitem.get("slug", "")
                processed_item["is_hardcoded_url"] = False

            processed_items.append(processed_item)

        res = await DB.insert_document(db_path, {
            "titles": item.get("titles") or {},
            "items": processed_items,
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
        result = await DB.delete_documents(db_path, {"titles.en": title})
        return result > 0  # Return True if at least one document was deleted
    except Exception as e:
        print(f"Error removing header item: {e}")
        return False

async def reorder_items(titles: List[str]) -> bool:
    """
    Reorders header items based on the provided list of titles.
    """
    try:
        # Update each item's index based on its position in the titles list
        res = True

        for index, title in enumerate(titles):
            # Update the document where title matches
            result = await DB.db[db_path].update_one(
                {"titles.en": title},
                {"$set": {"index": index, "updated_at": datetime.utcnow()}}
            )

            # If any update fails, log but continue with others
            if not result:
                res = False
                break

        return res
    except Exception as e:
        print(f"Error reordering header items: {e}")
        return False

async def change_visibility(title: str, visible: bool) -> bool:
    """
    Changes the visibility of a header item.
    """
    try:
        result = await DB.db[db_path].update_one(
            {"titles.en": title},
            {"$set": {"visible": visible, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error changing header item visibility: {e}")
        return False

async def update_item(title: str, updated_item: dict) -> bool:
    try:
        # Check if the item exists
        item = (await DB.find_documents(db_path, {"titles.en": title}))[0]
        if not item:
            return False

        # Add timestamp
        updated_item["updated_at"] = datetime.utcnow()

        # Update the document
        result = await DB.db[db_path].update_one(
            {"titles.en": title},
            {"$set": updated_item}
        )

        return result.modified_count > 0
    except Exception as e:
        print(f"Error updating header item: {e}")
        return False