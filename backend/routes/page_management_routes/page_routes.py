from fastapi import APIRouter, Body, Path, HTTPException, Depends
from mongo.database import DB
from models.page_models import Page
from bson import ObjectId, errors as bson_errors
from datetime import datetime

# TODO: make page perms
mod_page_router = APIRouter(prefix="/pages", tags=["pages mod"])

public_page_router = APIRouter(prefix="/pages", tags=["pages public"])


# Mod Router
# @router.post("/api/pages", dependencies=[Depends(permission_required(["can_create_pages"]))])
@mod_page_router.post("/")
async def create_page(page: Page = Body(...)):
    if not page.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if not page.slug.strip():
        raise HTTPException(status_code=400, detail="Slug is required")

    existing_page = await DB.db["pages"].find_one({"slug": page.slug})
    if existing_page:
        raise HTTPException(status_code=400, detail="Slug already exists. Please choose a different slug.")

    page_data = page.dict()
    page_data["created_at"] = datetime.utcnow()
    page_data["updated_at"] = datetime.utcnow()
    page_data["visible"] = True
    result = await DB.db["pages"].insert_one(page_data)
    return {"_id": str(result.inserted_id)}

# Public Router
@public_page_router.get("/{slug}")
async def get_page_by_slug(slug: str):
    page = await DB.db["pages"].find_one({
        "slug": slug,
        "visible": True,
        "published": True
    })
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["_id"] = str(page["_id"])
    return page

# Public Router - List visible pages only
@public_page_router.get("/")
async def list_visible_pages(skip: int = 0, limit: int = 20):
    """
    List all visible and published pages for public consumption (navigation, menus, etc.)
    Only returns pages where both visible=True and published=True
    """
    cursor = DB.db["pages"].find({
        "visible": True,
        "published": True
    }).skip(skip).limit(limit)
    pages = await cursor.to_list(length=limit)
    for page in pages:
        page["_id"] = str(page["_id"])
    return pages

# Mod Router
# @router.put("/api/pages/{page_id}", dependencies=[Depends(permission_required(["can_edit_pages"]))])
@mod_page_router.put("/{page_id}")
async def update_page_sections(
    page_id: str = Path(...),
    data: dict = Body(...)
):
    data["updated_at"] = datetime.utcnow()
    if "title" in data and not isinstance(data["title"], str):
        raise HTTPException(status_code=400, detail="Invalid title format")
    if "slug" in data and not isinstance(data["slug"], str):
        raise HTTPException(status_code=400, detail="Invalid slug format")
    try:
        object_id = ObjectId(page_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid page ID format")

    result = await DB.db["pages"].update_one(
        {"_id": object_id},
        {"$set": data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    
    return {"matched": result.matched_count, "modified": result.modified_count}

# Mod Router
@mod_page_router.delete("/{page_id}")
async def delete_page(page_id: str = Path(...)):
    try:
        object_id = ObjectId(page_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid page ID format")

    result = await DB.db["pages"].delete_one({"_id": object_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")

    return {"deleted": result.deleted_count}

# Mod Router - List all pages (including hidden ones) for admin management
@mod_page_router.get("/")
async def list_all_pages(skip: int = 0, limit: int = 20):
    """
    List all pages for admin management (including hidden pages)
    Returns all pages regardless of visibility status
    """
    cursor = DB.db["pages"].find().skip(skip).limit(limit)
    pages = await cursor.to_list(length=limit)
    for page in pages:
        page["_id"] = str(page["_id"])
    return pages

# Mod Router
@mod_page_router.get("/check-slug")
async def check_slug_availability(slug: str):
    existing_page = await DB.db["pages"].find_one({"slug": slug})
    return {"available": existing_page is None}

# Mod Router
@mod_page_router.put("/{page_id}/visibility")
async def toggle_page_visibility(page_id: str = Path(...), visible: bool = Body(...)):
    try:
        object_id = ObjectId(page_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid page ID format")

    result = await DB.db["pages"].update_one(
        {"_id": object_id},
        {"$set": {"visible": visible, "updated_at": datetime.utcnow()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")

    return {"matched": result.matched_count, "modified": result.modified_count}
