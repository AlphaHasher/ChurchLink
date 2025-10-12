import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Path, Form, Query
from fastapi.responses import FileResponse, Response
from helpers.Firebase_helpers import role_based_access
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

assets_router = APIRouter(prefix="/assets", tags=["assets"])

@assets_router.post("/upload")
async def upload_asset(
    file: UploadFile = File(...),
    folder: str = Form(None),  # Optional folder path, e.g., "images/events"
    current_user = Depends(role_based_access(["admin"]))
):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    
    content = await file.read()
    
    # Resize image if necessary
    try:
        img = Image.open(io.BytesIO(content))
        max_size = 3840
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        save_format = img.format if img.format else 'JPEG'
        img.save(output, format=save_format, quality=95)
        content = output.getvalue()
    except Exception as e:
        logger.warning(f"Image resizing failed: {e}, serving original")
        # keep original content
    
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Build path: base + folder + filename
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
        logger.info(f"Uploaded asset: {unique_filename} to {folder or 'root'}")
        
        # Generate thumbnail during upload
        thumb_filename = unique_filename.rsplit('.', 1)[0] + '_thumb.jpg'
        thumb_folder_path = folder if folder else ''
        thumb_dir = os.path.join(THUMBNAILS_DIR, thumb_folder_path)
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_path = os.path.join(thumb_dir, thumb_filename)
        try:
            thumb_img = Image.open(full_path)
            thumb_size = 250
            thumb_img.thumbnail((thumb_size, thumb_size), Image.Resampling.LANCZOS)
            if thumb_img.mode in ("RGBA", "P"):
                thumb_img = thumb_img.convert("RGB")
            thumb_output = io.BytesIO()
            thumb_img.save(thumb_output, format="JPEG", quality=80, optimize=True)
            with open(thumb_path, "wb") as thumb_buffer:
                thumb_buffer.write(thumb_output.getvalue())
            logger.info(f"Generated thumbnail: {thumb_filename} in {thumb_folder_path}")
        except Exception as thumb_e:
            logger.error(f"Thumbnail generation failed during upload: {thumb_e}")
           
        
        return {"url": asset_url, "filename": unique_filename, "folder": folder or "root"}
    
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Upload failed")

@assets_router.post("/folder")
async def create_folder(
    name: str = Form(..., description="Folder name"),
    parent: str = Form(None, description="Optional parent folder path"),
    current_user = Depends(role_based_access(["admin"]))
):
    if not name or '/' in name:
        raise HTTPException(status_code=400, detail="Folder name cannot contain '/' and must be provided")
    full_path = name
    if parent:
        full_path = os.path.join(parent, name)
    target_path = os.path.join(ASSETS_DIR, full_path)
    try:
        os.makedirs(target_path, exist_ok=True)
        logger.info(f"Created folder: {full_path}")
        return {"message": "Folder created", "folder": full_path}
    except Exception as e:
        logger.error(f"Folder creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create folder")

@assets_router.get("/")
async def list_contents(
    limit: Optional[int] = Query(None), 
    folder: str = Query(None), 
    current_user = Depends(role_based_access(["admin"]))
):
    files = []
    folders_list = []
    try:
        target_dir = ASSETS_DIR if not folder else os.path.join(ASSETS_DIR, folder)
        if os.path.exists(target_dir):
            all_items = os.listdir(target_dir)
            if limit is not None:  
                all_items = all_items[:limit]
            logger.info(f"Listing {target_dir}: items={all_items}")
            for item in all_items:
                item_path = os.path.join(target_dir, item)
                if os.path.isdir(item_path):
                    folders_list.append(item)
                elif os.path.isfile(item_path) and item.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
                    if item.endswith('_thumb.jpg'):
                        continue
                    full_url = f"/assets/{folder or ''}/{item}" if folder else f"/assets/{item}"
                    files.append({"filename": item, "url": full_url, "folder": folder or "root"})
            logger.info(f"Listing {target_dir}: files={len(files)}, folders={len(folders_list)}")
        else:
            logger.warning(f"Folder does not exist: {target_dir}")
        # If folder doesn't exist, return empty lists (no error)
    except OSError as e:
        logger.error(f"Directory listing error for {target_dir}: {e}")
        # Return empty
    return {"files": files, "folders": folders_list}


@assets_router.get("/{path:path}")
async def serve_asset(
    path: str,
    thumbnail: bool = Query(False, description="Serve thumbnail version")
):
    full_path = os.path.join(ASSETS_DIR, path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if not thumbnail:
        return FileResponse(full_path)
    else:
       
        basename = os.path.basename(path)
        name_without_ext = basename.rsplit('.', 1)[0]
        folder_part = path.rsplit('/', 1)[0] if '/' in path else ''
        thumb_dir = os.path.join(THUMBNAILS_DIR, folder_part)
        thumb_path = os.path.join(thumb_dir, f"{name_without_ext}_thumb.jpg")
        if os.path.exists(thumb_path):
            logger.info(f"Serving cached/pre-generated thumbnail: {thumb_path}")
            return FileResponse(thumb_path)
        
       
        try:
            original_size = os.path.getsize(full_path)
            logger.info(f"Starting on-the-fly thumbnail for {path} (original size: {original_size} bytes)")
            img = Image.open(full_path)  # Open directly from file path to save memory (no full byte load)
            thumb_size = 300
            img.thumbnail((thumb_size, thumb_size), Image.Resampling.LANCZOS)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=80, optimize=True)
            
            # Cache the generated thumbnail to disk for future requests
            try:
                # Use the computed thumb_dir from above
                os.makedirs(thumb_dir, exist_ok=True)  # Ensure folder exists
                with open(thumb_path, "wb") as cached_thumb:
                    cached_thumb.write(output.getvalue())
                logger.info(f"Successfully cached thumbnail for {path} at {thumb_path} (thumbnail size: {len(output.getvalue())} bytes, dimensions: {img.size})")
            except Exception as cache_e:
                logger.warning(f"Failed to cache thumbnail for {path}: {cache_e} - will generate on-the-fly next time")
            
            return Response(content=output.getvalue(), media_type="image/jpeg")
        except Exception as e:
            logger.error(f"On-the-fly thumbnail generation failed for {path}: {type(e).__name__}: {e} - serving full image as fallback")
            return FileResponse(full_path)

@assets_router.delete("/{path:path}")
async def delete_asset(
    path: str = Path(...),
    current_user = Depends(role_based_access(["admin"]))
):
    file_path = os.path.join(ASSETS_DIR, path)
    if os.path.exists(file_path):
        os.remove(file_path)
        logger.info(f"Deleted asset: {path}")
        
        # Delete thumbnail
        folder_part = os.path.dirname(path) if '/' in path else ''
        basename = os.path.basename(path)
        name_without_ext = basename.rsplit('.', 1)[0] if '.' in basename else basename
        thumb_dir = os.path.join(THUMBNAILS_DIR, folder_part)
        thumb_filename = f"{name_without_ext}_thumb.jpg"
        thumb_path = os.path.join(thumb_dir, thumb_filename)
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
            logger.info(f"Deleted thumbnail: {thumb_filename} in {folder_part}")
        
        return {"message": "Asset deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Asset not found")
