from typing import Optional, List, Tuple, Any

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Query, Path, Body
from fastapi.responses import Response

from controllers.assets_controller import (
    upload_images,
    list_images_and_folders,
    update_image_by_id,
    delete_image_by_id,
    get_image_by_id,
    load_image_bytes_by_id,
    create_folder,
    rename_folder,
    move_folder_ctrl,
    delete_folder_ctrl,
    list_subfolders,
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
)

public_assets_router = APIRouter(prefix="/assets", tags=["assets:public"])
mod_assets_router = APIRouter(prefix="/assets", tags=["assets"])
protected_assets_router = APIRouter(prefix="/assets", tags=["assets"])

@protected_assets_router.post("/upload", response_model=List[ImageResponse])
async def upload_asset(
    files: Optional[List[UploadFile]] = File(default=None, description="One or more image files (key: files)"),
    file: Optional[UploadFile] = File(default=None, description="Single image file (key: file)"),
    folder: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
):
    file_list: List[UploadFile] = []
    if files:
        file_list = files
    elif file is not None:
        file_list = [file]

    if not file_list:
        raise HTTPException(status_code=400, detail="No files provided. Use field 'files' or 'file'.")

    meta = UploadImageRequest(folder=folder, description=description)
    images = await upload_images(meta, file_list)
    return images

@mod_assets_router.get("/", response_model=dict)
async def list_contents(
    folder: Optional[str] = Query(default=None, description="Relative folder path under assets ('' = Home)"),
    q: Optional[str] = Query(default=None, description="Search by image name (substring, case-insensitive)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=60, ge=1, le=500),
    scope: str = Query(default="current", pattern="^(current|all)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=500),
):
    data = await list_images_and_folders(folder, q, limit, page=page, page_size=page_size, scope=scope)
    return data

@protected_assets_router.patch("/{id}", response_model=ImageResponse)
async def api_update_image(
    id: str = Path(..., description="ObjectId string"),
    payload: ImageUpdateRequest = Body(..., description="Optional fields to update"),
):
    resp = await update_image_by_id(id, payload)
    if resp is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return resp

@protected_assets_router.delete("/{id}", response_model=dict)
async def api_delete_asset(id: str = Path(..., description="ObjectId string")):
    ok = await delete_image_by_id(id)
    if not ok:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"message": "Asset deleted successfully"}

@public_assets_router.get("/public/id/{id}")
async def serve_asset(
    id: str = Path(..., description="ObjectId string"),
    thumbnail: bool = Query(False),
    download: bool = Query(False),
):
    """
    Returns the file bytes. Works with controller functions that return either:
      - (bytes, media_type)
      - (bytes, media_type, suggested_filename)
    When ?download=1 is used, we set Content-Disposition with a friendly filename.
    """
    try:
        result: Any = await load_image_bytes_by_id(id, thumbnail=thumbnail)
    except Exception:
        # Preserve 404 vs 500 clarity: if the controller itself raises, surface 404 where applicable
        raise

    # Normalize to 3-tuple
    data: Optional[bytes]
    media_type: str
    suggested_name: Optional[str] = None

    if isinstance(result, tuple):
        if len(result) == 3:
            data, media_type, suggested_name = result  # type: ignore[assignment]
        elif len(result) == 2:
            data, media_type = result  # type: ignore[misc]
        else:
            raise HTTPException(status_code=500, detail="Invalid controller response")
    else:
        raise HTTPException(status_code=500, detail="Invalid controller response")

    if data is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    # If download is requested and we don't already have a suggested filename, derive it.
    headers = {}
    if download:
        if not suggested_name:
            # Pull from DB metadata
            meta = await get_image_by_id(id)
            base = (meta.name if meta and meta.name else id)
            ext = (meta.extension if meta and meta.extension else "bin")
            suggested_name = f"{base}.{ext}"
        headers["Content-Disposition"] = f'attachment; filename="{suggested_name}"'

    return Response(content=data, media_type=media_type, headers=headers)

@mod_assets_router.get("/folders", response_model=dict)
async def api_list_folders(folder: Optional[str] = Query(default=None, description="Relative folder under assets ('' = Home)")):
    subs: List[str] = await list_subfolders(folder)
    return {"folders": subs}

@protected_assets_router.post("/folders/create", response_model=FolderResponse)
async def api_folder_create(payload: FolderCreateRequest = Body(...)):
    return await create_folder(payload)

@protected_assets_router.patch("/folders/rename", response_model=FolderResponse)
async def api_folder_rename(payload: FolderRenameRequest = Body(...)):
    return await rename_folder(payload)

@protected_assets_router.patch("/folders/move", response_model=FolderResponse)
async def api_folder_move(payload: FolderMoveRequest = Body(...)):
    return await move_folder_ctrl(payload)

@protected_assets_router.patch("/folders/delete", response_model=FolderResponse)
async def api_folder_delete(payload: FolderDeleteRequest = Body(...)):
    return await delete_folder_ctrl(payload)