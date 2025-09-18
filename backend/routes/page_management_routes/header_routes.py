from typing import List

from fastapi import APIRouter, HTTPException, Body, Path
from mongo.database import DB
from models.header import *

public_header_router = APIRouter(prefix="/header", tags=["public header"])
mod_header_router = APIRouter(prefix="/header", tags=["mod header"])


# Public Route
@public_header_router.get("", response_model=Header)
async def get_header_route():
    """Get the current header."""
    header = await get_header()
    if not header:
        raise HTTPException(status_code=404, detail="Header not found and could not create default")
    return header

# Mod Route
@public_header_router.get("/items", response_model=Header)
async def get_header_items_route():
    """Get the current header."""
    header = await get_header_items()
    if not header:
        raise HTTPException(status_code=404, detail="Header not found and could not create default")
    return header

 # Mod Route
@mod_header_router.post("/items/links", response_model=bool)
async def add_header_link_route(item: HeaderLink = Body(...)):
    """Add a new item to the header."""
    success = await add_link(dict(item))
    if not success:
        raise HTTPException(status_code=404, detail="Header not found or update failed")

    return success

# Mod Route
@mod_header_router.post("/items/dropdowns", response_model=bool)
async def add_header_dropdown_route(item: HeaderDropdown = Body(...)):
    """Add a new item to the header."""
    success = await add_dropdown(dict(item))
    if not success:
        raise HTTPException(status_code=404, detail="Header not found or update failed")

    return success is not None

# Mod Route
@mod_header_router.get("/{title}", response_model=HeaderItem)
async def get_header_item_route(title: str = Path(...)):
    """Remove an item from the header by title."""
    item = await get_item_by_title(title)
    if not item:
        raise HTTPException(status_code=404, detail="Header not found, item not found, or update failed")
    # Update type attribute to match the HeaderItem type
    # Return updated header
    return item

# Mod Route
@mod_header_router.put("/items/edit/{title}", response_model=bool)
async def update_header_item_route(title: str = Path(...), updated_item: dict = Body(...)):
    """Update an item in the header by title."""
    success = await update_item(title, updated_item)
    if not success:
        raise HTTPException(status_code=404, detail="Header item not found or update failed")
    return success

# Mod Route
@mod_header_router.delete("/{title}", response_model=bool)
async def remove_header_item_route(title: str = Path(...)):
    """Remove an item from the header by title."""
    success = await remove_item_by_name(title)
    if not success:
        raise HTTPException(status_code=404, detail="Header item not found or could not be deleted")
    return success

# Mod Route
@mod_header_router.put("/reorder", response_model=bool)
async def reorder_header_items_route(titles: dict = Body(...)):
    """Reorder header items based on the provided list of titles."""
    success = await reorder_items(titles["titles"])
    if not success:
        raise HTTPException(status_code=400, detail="Failed to reorder header items")
    return success is not None

# Mod Route
@mod_header_router.put("/{title}/visibility", response_model=bool)
async def change_header_item_visibility_route(title: str = Path(...), visible: dict = Body(...)):
    """Change visibility of a header item."""
    success = await change_visibility(title, visible["visible"])
    if not success:
        raise HTTPException(status_code=404, detail="Header item not found or update failed")
    return success