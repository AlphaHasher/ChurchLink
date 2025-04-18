from fastapi import APIRouter, HTTPException, status, Body, Path
from mongo.database import DB
from models.header import Header, HeaderDropdown, HeaderLink, HeaderItem, remove_item_by_name, get_header, get_item_by_title, add_link, add_dropdown
from typing import List
from bson import ObjectId, errors as bson_errors

header_router = APIRouter(prefix="/api/header")

@header_router.get("", response_model=Header)
async def get_header_route():
    """Get the current header."""
    header = await get_header()
    if not header:
        raise HTTPException(status_code=404, detail="Header not found and could not create default")
    return header

@header_router.post("/items/links", response_model=bool)
async def add_header_link_route(item: HeaderLink = Body(...)):
    """Add a new item to the header."""
    success = await add_link(dict(item))
    if not success:
        raise HTTPException(status_code=404, detail="Header not found or update failed")

    return success

@header_router.post("/items/dropdowns", response_model=Header)
async def add_header_dropdown_route(item: HeaderDropdown = Body(...)):
    """Add a new item to the header."""
    print(item)
    success = await add_dropdown(dict(item))
    if not success:
        raise HTTPException(status_code=404, detail="Header not found or update failed")

    # Return updated header
    updated_header = await get_header()
    return updated_header

@header_router.get("/{title}", response_model=Header)
async def get_header_item_route(title: str = Path(...)):
    """Remove an item from the header by title."""
    item = await get_item_by_title(title)
    if not item:
        raise HTTPException(status_code=404, detail="Header not found, item not found, or update failed")
    # Update type attribute to match the HeaderItem type


    # Return updated header
    return item

@header_router.delete("/items/{title}", response_model=bool)
async def remove_header_item_route(title: str = Path(...)):
    """Remove an item from the header by title."""
    success = await remove_item_by_name(title)
    if not success:
        raise HTTPException(status_code=404, detail="Header item not found or could not be deleted")
    return success