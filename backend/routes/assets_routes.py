# assets_routes.py
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Query, Path
from fastapi.responses import Response
from bson import ObjectId
from pydantic import ValidationError

from controllers.assets_controller import (
    save_image_with_id,
    load_image_bytes_by_id,
    remove_image_by_id,
    update_image_by_id,
    create_folder,
    rename_folder,
    move_folder,
    delete_folder,
    list_subfolders,
    _extract_folder_rel,
)
from models.image_data import (
    UploadImageRequest,
    ImageResponse,
    ImageUpdateRequest,
    FolderCreateRequest,
    FolderRenameRequest,
    FolderMoveRequest,
    FolderDeleteRequest,
    FolderResponse,
    list_image_data,
)

public_assets_router = APIRouter(prefix="/assets", tags=["assets:public"])
protected_assets_router = APIRouter(prefix="/assets", tags=["assets"])

# ========================
# Upload (file + meta model)
# ========================
@protected_assets_router.post("/upload", response_model=ImageResponse)
async def upload_asset(
    file: UploadFile = File(..., description="The image file"),
    folder: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
):
    """
    Accept binary upload and structured metadata (folder/description) as model.
    """
    meta = UploadImageRequest(folder=folder, description=description)
    new_id = ObjectId()
    return await save_image_with_id(new_id, file, meta)

# ============
# List by DB
# ============
@protected_assets_router.get("/", response_model=dict)
async def list_contents(
    limit: Optional[int] = Query(default=None, ge=1, le=500),
    folder: Optional[str] = Query(default=None, description="Relative folder path under assets"),
    q: Optional[str] = Query(default=None, description="Search by name"),
):
    docs = await list_image_data(limit=limit, folder=folder, q=q)
    items = []
    for d in docs:
        derived_folder = _extract_folder_rel(d["path"])
        folder_value = folder if folder is not None else (derived_folder or "")
        items.append(
            ImageResponse(
                id=d["_id"],
                name=d["name"],
                extension=d["extension"],
                description=d.get("description"),
                folder=folder_value,
                path=d["path"],
                public_url=f"/api/v1/assets/public/{d['_id']}",
                thumb_url=f"/api/v1/assets/public/{d['_id']}?thumbnail=true",
            )
        )
    return {"items": items}

# ======================
# Update / Delete Image
# ======================
@protected_assets_router.patch("/{id}", response_model=ImageResponse)
async def update_image(
    id: str = Path(..., description="ObjectId string"),
    payload: ImageUpdateRequest = None,
):
    if payload is None:
        raise HTTPException(status_code=400, detail="Missing body")
    return await update_image_by_id(id, payload)

@protected_assets_router.delete("/{id}", response_model=dict)
async def delete_asset(
    id: str = Path(..., description="ObjectId string"),
):
    ok = await remove_image_by_id(id)
    if not ok:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"message": "Asset deleted successfully"}

# ===========================
# Serve by ID (public access)
# ===========================
@public_assets_router.get("/public/{id}")
async def serve_asset(
    id: str = Path(..., description="ObjectId string"),
    thumbnail: bool = Query(False),
):
    data, media_type = await load_image_bytes_by_id(id, thumbnail=thumbnail)
    return Response(content=data, media_type=media_type)

# ==================
# Folder operations
# ==================

@protected_assets_router.get("/folders", response_model=dict)
async def list_folders(
    folder: Optional[str] = Query(default=None, description="Relative folder under assets")
):
    subs: List[str] = await list_subfolders(folder)
    return {"folders": subs}

@protected_assets_router.post("/folders/create", response_model=FolderResponse)
async def api_folder_create(payload: FolderCreateRequest):
    return await create_folder(payload)

@protected_assets_router.patch("/folders/rename", response_model=FolderResponse)
async def api_folder_rename(payload: FolderRenameRequest):
    return await rename_folder(payload)

@protected_assets_router.patch("/folders/move", response_model=FolderResponse)
async def api_folder_move(payload: FolderMoveRequest):
    return await move_folder(payload)

@protected_assets_router.delete("/folders", response_model=FolderResponse)
async def api_folder_delete(payload: FolderDeleteRequest):
    return await delete_folder(payload)
