import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Path, Form, Query
from fastapi.responses import FileResponse, Response
from PIL import Image
import io
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Image.MAX_IMAGE_PIXELS = None
Image.LOAD_TRUNCATED_IMAGES = True

ASSETS_DIR = "data/assets"
THUMBNAILS_DIR = "data/thumbnails"
os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(THUMBNAILS_DIR, exist_ok=True)

public_assets_router = APIRouter(prefix="/assets", tags=["assets"])
protected_assets_router = APIRouter(prefix="/assets", tags=["assets"])

@protected_assets_router.post("/upload")
async def upload_asset(
    file: UploadFile = File(...),
    folder: str = Form(None),
):
    if not file or not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    
    content = await file.read()
    
    try:
        img = Image.open(io.BytesIO(content))
        if max(img.size) > 3840:
            img.thumbnail((3840, 3840), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        img.save(output, format=img.format or 'JPEG', quality=95)
        content = output.getvalue()
    except Exception as e:
        logger.warning(f"Image resizing failed: {e}")
    
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    if folder:
        folder_path = os.path.join(ASSETS_DIR, folder)
        os.makedirs(folder_path, exist_ok=True)
        full_path = os.path.join(folder_path, unique_filename)
        asset_url = f"/assets/{folder}/{unique_filename}"
    else:
        full_path = os.path.join(ASSETS_DIR, unique_filename)
        asset_url = f"/assets/{unique_filename}"
    
    try:
        with open(full_path, "wb") as buffer:
            buffer.write(content)
        
        thumb_filename = unique_filename.rsplit('.', 1)[0] + '_thumb.jpg'
        thumb_folder_path = folder if folder else ''
        thumb_dir = os.path.join(THUMBNAILS_DIR, thumb_folder_path)
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_path = os.path.join(thumb_dir, thumb_filename)
        
        try:
            thumb_img = Image.open(full_path)
            thumb_img.thumbnail((250, 250), Image.Resampling.LANCZOS)
            if thumb_img.mode in ("RGBA", "P"):
                thumb_img = thumb_img.convert("RGB")
            thumb_output = io.BytesIO()
            thumb_img.save(thumb_output, format="JPEG", quality=80, optimize=True)
            with open(thumb_path, "wb") as thumb_buffer:
                thumb_buffer.write(thumb_output.getvalue())
        except Exception as thumb_e:
            logger.error(f"Thumbnail generation failed: {thumb_e}")
        
        return {"url": asset_url, "filename": unique_filename, "folder": folder or "root"}
    
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Upload failed")

@protected_assets_router.post("/folder")
async def create_folder(
    name: str = Form(...),
    parent: str = Form(None),
):
    if not name or '/' in name:
        raise HTTPException(status_code=400, detail="Invalid folder name")
    
    full_path = os.path.join(parent, name) if parent else name
    target_path = os.path.join(ASSETS_DIR, full_path)
    
    try:
        os.makedirs(target_path, exist_ok=True)
        return {"message": "Folder created", "folder": full_path}
    except Exception as e:
        logger.error(f"Folder creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create folder")

@protected_assets_router.get("/")
async def list_contents(
    limit: Optional[int] = Query(None),
    folder: str = Query(None),
):
    files = []
    folders_list = []
    
    try:
        target_dir = os.path.join(ASSETS_DIR, folder) if folder else ASSETS_DIR
        if not os.path.exists(target_dir):
            return {"files": files, "folders": folders_list}
        
        all_items = os.listdir(target_dir)
        if limit is not None:
            all_items = all_items[:limit]
        
        for item in all_items:
            item_path = os.path.join(target_dir, item)
            if os.path.isdir(item_path):
                folders_list.append(item)
            elif (os.path.isfile(item_path) and 
                  item.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")) and
                  not item.endswith('_thumb.jpg')):
                full_url = f"/api/v1/assets/public/{folder}/{item}" if folder else f"/api/v1/assets/public/{item}"
                files.append({"filename": item, "url": full_url, "folder": folder or "root"})
        
    except OSError as e:
        logger.error(f"Directory listing error: {e}")
    
    return {"files": files, "folders": folders_list}



@protected_assets_router.delete("/{path:path}")
async def delete_asset(path: str = Path(...)):
    file_path = os.path.join(ASSETS_DIR, path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Asset not found")
    
    os.remove(file_path)
    
    folder_part = os.path.dirname(path) if '/' in path else ''
    basename = os.path.basename(path)
    name_without_ext = basename.rsplit('.', 1)[0] if '.' in basename else basename
    thumb_path = os.path.join(THUMBNAILS_DIR, folder_part, f"{name_without_ext}_thumb.jpg")
    
    if os.path.exists(thumb_path):
        os.remove(thumb_path)
    
    return {"message": "Asset deleted successfully"}



@public_assets_router.get("/public/{path:path}")
async def serve_asset(
    path: str,
    thumbnail: bool = Query(False),
):
    full_path = os.path.join(ASSETS_DIR, path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if not thumbnail:
        return FileResponse(full_path)
    
    basename = os.path.basename(path)
    name_without_ext = basename.rsplit('.', 1)[0]
    folder_part = path.rsplit('/', 1)[0] if '/' in path else ''
    thumb_path = os.path.join(THUMBNAILS_DIR, folder_part, f"{name_without_ext}_thumb.jpg")
    
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path)
    
    try:
        img = Image.open(full_path)
        img.thumbnail((300, 300), Image.Resampling.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=80, optimize=True)
        
        try:
            os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
            with open(thumb_path, "wb") as cached_thumb:
                cached_thumb.write(output.getvalue())
        except Exception as cache_e:
            logger.warning(f"Failed to cache thumbnail: {cache_e}")
        
        return Response(content=output.getvalue(), media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return FileResponse(full_path)



