from typing import List

from fastapi import APIRouter, HTTPException, Body, Path
from mongo.database import DB
from models.footer import *

footer_router = APIRouter(prefix="/api/footer")

@footer_router.get("", response_model=Footer)
async def get_footer_route():
    """Get the current footer."""
    footer = await get_footer()
    if not footer:
        raise HTTPException(status_code=404, detail="Footer not found and could not create default")
    return footer

@footer_router.get("/items", response_model=Footer)
async def get_footer_items_route():
    """Get the current footer."""
    footer = await get_footer_items()
    if not footer:
        raise HTTPException(status_code=404, detail="Footer not found and could not create default")
    return footer

@footer_router.put("/{title}/visibility", response_model=bool)
async def change_footer_item_visibility_route(title: str = Path(...), visible: dict = Body(...)):
    """Change visibility of a footer item."""
    success = await change_visibility(title, visible["visible"])
    if not success:
        raise HTTPException(status_code=404, detail="Footer item not found or update failed")
    return success

@footer_router.put("/reorder", response_model=bool)
async def reorder_footer_items_route(titles: dict = Body(...)):
    """Reorder footer items based on the provided list of titles."""
    success = await reorder_items(titles["titles"])
    if not success:
        raise HTTPException(status_code=400, detail="Failed to reorder footer items")
    return success is not None

@footer_router.delete("/{title}", response_model=bool)
async def remove_footer_item_route(title: str = Path(...)):
    """Remove an item from the footer by title."""
    success = await remove_item_by_name(title)
    if not success:
        raise HTTPException(status_code=404, detail="Footer item not found or could not be deleted")
    return success

@footer_router.post("/items", response_model=bool)
async def add_footer_item_route(item: FooterItem = Body(...)):
    """Add a new item to the footer."""
    success = await add_item(dict(item))
    if not success:
        raise HTTPException(status_code=404, detail="Footer not found or update failed")

    return success

@footer_router.get("/{title}", response_model=FooterItem)
async def get_footer_item_route(title: str = Path(...)):
    """Remove an item from the footer by title."""
    item = await get_item_by_title(title)
    if not item:
        raise HTTPException(status_code=404, detail="Footer not found, item not found, or update failed")
    # Update type attribute to match the footerItem type
    # Return updated footer
    return item

@footer_router.put("/items/edit/{title}", response_model=bool)
async def update_footer_item_route(title: str = Path(...), updated_item: dict = Body(...)):
    """Update an item in the footer by title."""
    success = await update_item(title, updated_item)
    if not success:
        raise HTTPException(status_code=404, detail="Footer item not found or update failed")
    return success