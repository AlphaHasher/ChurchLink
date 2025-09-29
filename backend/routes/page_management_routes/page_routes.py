from fastapi import APIRouter, Body, Path, HTTPException, Depends
from mongo.database import DB
from models.page_models import Page
from bson import ObjectId, errors as bson_errors
from datetime import datetime
from urllib.parse import unquote

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

# Public Router - Get page by slug (moved under /slug to avoid conflict with list endpoint)
@public_page_router.get("/slug/{slug:path}")
async def get_page_by_slug(slug: str):
    # Normalize and safely decode slug (handles double-encoding)
    decoded = unquote(unquote(slug or "")).strip()
    if decoded == "" or decoded == "home":
        decoded = "/"

    # Try exact match first
    page = await DB.db["pages"].find_one({
        "slug": decoded,
        "visible": True
    })

    # Fallback: if root not found, try "home"
    if not page and decoded == "/":
        page = await DB.db["pages"].find_one({
            "slug": "home",
            "visible": True
        })
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
    cursor = DB.db["pages"].find({
        "visible": True
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

# ------------------------------
# Staging/Draft Endpoints
# ------------------------------

@public_page_router.get("/staging/{slug:path}")
async def get_staging_page(slug: str):
    """Fetch a staging (draft) page by slug (public preview)."""
    page = await DB.db["pages_staging"].find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Staging page not found")
    page["_id"] = str(page["_id"])
    return page


@mod_page_router.put("/staging/{slug:path}")
async def upsert_staging_page(
    slug: str = Path(...),
    data: dict = Body(...)
):
    """Create or update a staging (draft) page by slug. Upserts by slug."""
    data = {**data}
    data["slug"] = slug
    data["updated_at"] = datetime.utcnow()

    result = await DB.db["pages_staging"].update_one(
        {"slug": slug},
        {"$set": data, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"upserted": getattr(result, "upserted_id", None) is not None, "modified": result.modified_count}


@mod_page_router.delete("/staging/{slug:path}")
async def delete_staging_page(slug: str):
    result = await DB.db["pages_staging"].delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staging page not found")
    return {"deleted": result.deleted_count}


@mod_page_router.post("/publish/{slug:path}")
async def publish_staging_page(slug: str):
    """Publish staging page to live collection by slug, replacing or creating live page. Removes staging copy afterwards."""
    staging = await DB.db["pages_staging"].find_one({"slug": slug})
    if not staging:
        raise HTTPException(status_code=404, detail="Staging page not found")

    # Fields allowed to publish
    publish_fields = {k: staging.get(k) for k in ["title", "slug", "sections", "visible"] if k in staging}
    publish_fields["updated_at"] = datetime.utcnow()

    await DB.db["pages"].update_one(
        {"slug": slug},
        {"$set": publish_fields, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True,
    )

    # Optionally remove staging version after publish
    await DB.db["pages_staging"].delete_one({"slug": slug})
    return {"published": True}

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

# Mod Router - Preview page for admin (bypasses visibility checks)
@mod_page_router.get("/preview/{slug:path}")
async def preview_page_by_slug(slug: str):
    """
    Preview any page by slug for admin purposes (bypasses visibility checks)
    This allows admins to preview pages even when they're hidden
    """
    decoded = unquote(unquote(slug or "")).strip()
    if decoded == "" or decoded == "home":
        decoded = "/"
    page = await DB.db["pages"].find_one({"slug": decoded})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["_id"] = str(page["_id"])
    return page
