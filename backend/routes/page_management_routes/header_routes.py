from fastapi import APIRouter, HTTPException, status, Body, Path
from mongo.database import DB
from models.header import Header, HeaderItem, get_header, add_item, remove_item, reorder_items
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

@header_router.post("/items", response_model=Header)
async def add_header_item_route(item: HeaderItem = Body(...)):
    """Add a new item to the header."""
    success = await add_item(item)
    if not success:
        raise HTTPException(status_code=404, detail="Header not found or update failed")

    # Return updated header
    updated_header = await get_header()
    return updated_header

@header_router.delete("/items/{title}", response_model=Header)
async def remove_header_item_route(title: str = Path(...)):
    """Remove an item from the header by title."""
    success = await remove_item(title)
    if not success:
        raise HTTPException(status_code=404, detail="Header not found, item not found, or update failed")

    # Return updated header
    updated_header = await get_header()
    return updated_header

@header_router.put("/reorder", response_model=Header)
async def reorder_header_items_route(items: List[HeaderItem] = Body(...)):
    success = await reorder_items(items)
    if not success:
        raise HTTPException(status_code=404, detail="Header not found or update failed")

    # Return updated header
    updated_header = await get_header()
    return updated_header