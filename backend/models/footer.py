# backend/models/footer.py
from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel
from mongo.database import DB

class FooterSubItem(BaseModel):
    title: str
    titles: Dict[str, str]
    url: Optional[str]
    visible: Optional[bool] = True

class FooterItem(BaseModel):
    title: str
    titles: Dict[str, str]
    items: List[FooterSubItem]
    visible: Optional[bool] = True

class Footer(BaseModel):
    items: List[FooterItem]

# CRUD Operations
db_path = "footer-items"

async def get_footer() -> Optional[Footer]:
    """
    Gets all footer items from the database.
    Combines them into ordered array to be used for NavBar.
    """
    try:
        items_data = await DB.find_documents(db_path)
        if not items_data:
            return None

        return Footer(items=items_data)
    except Exception as e:
        print(f"Error getting footer items: {e}")
        return None

async def get_footer_items() -> Optional[Footer]:
    """
    Gets all footer items from the database.
    Combines them into ordered array to be used for NavBar.
    """
    try:
        items_data = await DB.find_documents(db_path)
        if not items_data:
            return None

        # Convert the MongoDB documents into FooterSubItem objects
        footer_items = [None] * len(items_data) # Make a full list to capture indexes
        for i in range(len(items_data)):
            item = items_data[i]
            footer_items[item["index"]] = FooterItem(
                title=item["title"],
                titles=item.get("titles") or {},
                items=item["items"],
                visible=item["visible"]
            )

        # Collapse list to remove hidden items
        public_footer = [i for i in footer_items if i is not None]
        return Footer(items=public_footer)
    except Exception as e:
        print(f"Error getting footer items: {e}")
        return None

async def change_visibility(title: str, visible: bool) -> bool:
    """
    Changes the visibility of a footer item.
    """
    try:
        result = await DB.db[db_path].update_one(
            {"title": title},
            {"$set": {"visible": visible, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error changing footer item visibility: {e}")
        return False

async def reorder_items(titles: List[str]) -> bool:
    """
    Reorders footer items based on the provided list of titles.
    """
    try:
        res = True

        for index, title in enumerate(titles):
            # Update the document where title matches
            result = await DB.db[db_path].update_one(
                {"title": title},
                {"$set": {"index": index, "updated_at": datetime.utcnow()}}
            )

            # If any update fails, log but continue with others
            if not result:
                res = False
                break

        return res
    except Exception as e:
        print(f"Error reordering footer items: {e}")
        return False

async def remove_item_by_name(title: str) -> bool:
    """
    Removes a footer item by its title.
    """
    try:
        result = await DB.delete_documents(db_path, {"title": title})
        return result > 0  # Return True if at least one document was deleted
    except Exception as e:
        print(f"Error removing footer item: {e}")
        return False

async def add_item(item: dict) -> bool:
    """
    Adds a new dropdown navigation item to the footer.
    """
    try:
        res = await DB.insert_document(db_path, {
            "title": item["title"],
            "titles": item.get("titles") or {},
            "items": [
                {
                    "title": subitem.title,
                    "titles": getattr(subitem, "titles", {}),
                    "url": subitem.url or None
                } for subitem in item["items"]
            ],
            "visible": item.get("visible", True),
            "index": len(await DB.find_documents(db_path, {})),
            "updated_at": datetime.utcnow()
        })
        return res is not None
    except Exception as e:
        print(f"Error adding dropdown navigation item to footer: {e}")
        return False

async def get_item_by_title(title: str) -> Optional[FooterItem]:
    """
    Gets a footer item by its title.
    Returns the item as either FooterLink or FooterDropdown based on its type.
    """
    try:
        items = await DB.find_documents(db_path, {"title": title})
        item = items[0] if items else None

        if not item:
            return None

        return FooterItem(title=item["title"], titles=item.get("titles") or {}, items=item["items"])

    except Exception as e:
        print(f"Error getting footer item by title: {e}")
        return None

async def update_item(title: str, updated_item: dict) -> bool:
    try:
        # Check if the item exists
        item = (await DB.find_documents(db_path, {"title": title}))[0]
        if not item:
            return False

        # Add timestamp
        updated_item["updated_at"] = datetime.utcnow()

        # Update the document
        result = await DB.db[db_path].update_one(
            {"title": title},
            {"$set": updated_item}
        )

        return result.modified_count > 0
    except Exception as e:
        print(f"Error updating header item: {e}")
        return False