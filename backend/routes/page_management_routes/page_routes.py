from fastapi import APIRouter, Body, Path, HTTPException
from mongo.database import DB
from models.page_models import Page
from helpers.slug_validator import validate_slug
from bson import ObjectId, errors as bson_errors
from datetime import datetime
from urllib.parse import unquote

# TODO: make page perms
mod_page_router = APIRouter(prefix="/pages", tags=["pages mod"])

public_page_router = APIRouter(prefix="/pages", tags=["pages public"])


# Internal helper to normalize slugs consistently (handles double-encoding and home/root)
def _normalize_slug(raw_slug: str) -> str:
    decoded = unquote(unquote(raw_slug or "")).strip()
    if decoded == "" or decoded == "home":
        return "/"
    return decoded


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
        raise HTTPException(
            status_code=400,
            detail="Slug already exists. Please choose a different slug.",
        )

    page_data = page.dict()
    page_data["created_at"] = datetime.utcnow()
    page_data["updated_at"] = datetime.utcnow()
    page_data["visible"] = True
    result = await DB.db["pages"].insert_one(page_data)
    return {"_id": str(result.inserted_id)}


# Public Router - Get page by slug (moved under /slug to avoid conflict with list endpoint)
@public_page_router.get("/slug/{slug:path}")
async def get_page_by_slug(slug: str):
    # Normalize and safely decode slug (handles double-encoding)
    decoded = _normalize_slug(slug)

    # Try exact match first
    page = await DB.db["pages"].find_one({"slug": decoded, "visible": True})

    # Fallback: if root not found, try "home"
    if not page and decoded == "/":
        page = await DB.db["pages"].find_one({"slug": "home", "visible": True})

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["_id"] = str(page["_id"])
    return page


# Public Router - List visible pages only
@public_page_router.get("/")
async def list_visible_pages(skip: int = 0, limit: int = 20):
    """
    List all visible pages for public consumption (navigation, menus, etc.)
    Only returns pages where visible=True
    """
    cursor = DB.db["pages"].find({"visible": True}).skip(skip).limit(limit)
    pages = await cursor.to_list(length=limit)
    for page in pages:
        page["_id"] = str(page["_id"])
    return pages


# Mod Router
# @router.put("/api/pages/{page_id}", dependencies=[Depends(permission_required(["can_edit_pages"]))])
@mod_page_router.put("/{page_id}")
async def update_page_sections(page_id: str = Path(...), data: dict = Body(...)):
    data["updated_at"] = datetime.utcnow()
    if "title" in data and not isinstance(data["title"], str):
        raise HTTPException(status_code=400, detail="Invalid title format")
    if "slug" in data:
        if not isinstance(data["slug"], str):
            raise HTTPException(status_code=400, detail="Invalid slug format")
        try:
            data["slug"] = validate_slug(data["slug"], allow_none=True, allow_root=True)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    try:
        object_id = ObjectId(page_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid page ID format")

    result = await DB.db["pages"].update_one({"_id": object_id}, {"$set": data})

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")

    return {"matched": result.matched_count, "modified": result.modified_count}


# Mod Router - Duplicate a page
@mod_page_router.post("/{page_id}/duplicate")
async def duplicate_page(page_id: str = Path(...)):
    """Duplicate a page with a new slug. The duplicated page will be hidden by default."""
    try:
        object_id = ObjectId(page_id)
    except bson_errors.InvalidId:
        raise HTTPException(status_code=400, detail="Invalid page ID")

    # Get original page
    original = await DB.db["pages"].find_one({"_id": object_id})
    if not original:
        raise HTTPException(status_code=404, detail="Page not found")

    # Create duplicate
    duplicate = {**original}
    del duplicate["_id"]

    # Generate unique slug (add -copy suffix and handle conflicts)
    base_slug = f"{original['slug']}-copy"
    new_slug = base_slug
    counter = 1

    # Check if slug exists and increment counter if needed
    while await DB.db["pages"].find_one({"slug": new_slug}):
        new_slug = f"{base_slug}-{counter}"
        counter += 1

    duplicate["slug"] = new_slug
    duplicate["title"] = f"{original['title']} (Copy)"
    duplicate["visible"] = False
    duplicate["created_at"] = datetime.utcnow()
    duplicate["updated_at"] = datetime.utcnow()

    result = await DB.db["pages"].insert_one(duplicate)
    return {"_id": str(result.inserted_id), "slug": duplicate["slug"], "title": duplicate["title"]}


@mod_page_router.post("/publish/{slug:path}")
async def publish_page(slug: str, data: dict = Body(...)):
    """
    Publish a page directly to the live pages collection.

    Accepts page data in the request body and upserts it directly to the live pages collection.

    Parameters:
        slug (str): Raw slug or path identifying the page to publish.
        data (dict): Page data including title and puckData.

    Returns:
        dict: `{'published': True}` when the publish completes successfully.
    """
    try:
        decoded = _normalize_slug(slug)

        # Build publish fields from request data
        allowed_keys = [
            "title",
            "format",      # "puck"
            "puckData",    # Puck editor data
        ]
        publish_fields = {k: data.get(k) for k in allowed_keys if k in data}
        publish_fields["slug"] = decoded
        publish_fields["visible"] = True
        publish_fields["updated_at"] = datetime.utcnow()

        await DB.db["pages"].update_one(
            {"slug": decoded},
            {"$set": publish_fields, "$setOnInsert": {"created_at": datetime.utcnow()}},
            upsert=True,
        )

        return {"published": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Publish failed: {str(e)}")


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
        {"$set": {"visible": visible, "updated_at": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")

    return {"matched": result.matched_count, "modified": result.modified_count}


# Mod Router - Preview page for admin (bypasses visibility checks)
@mod_page_router.get("/preview/{slug:path}")
async def preview_page_by_slug(slug: str):
    """
    Preview any page by slug for admin purposes (bypasses visibility checks)
    This allows admins to preview pages even when they're hidden
    """
    decoded = _normalize_slug(slug)
    page = await DB.db["pages"].find_one({"slug": decoded})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["_id"] = str(page["_id"])
    return page