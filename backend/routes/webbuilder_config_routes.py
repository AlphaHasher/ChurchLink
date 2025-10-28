"""
Web Builder Configuration Routes
Provides endpoints for managing website configuration like favicon, title, etc.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any
from helpers.WebbuilderConfigHelper import WebbuilderConfigHelper
from models.website_app_config import WebsiteConfigUpdate, TitleUpdateRequest
import os
import shutil
from pathlib import Path

# Public routes - accessible by frontend to get current config
webbuilder_config_public_router = APIRouter(prefix="/website", tags=["Web Builder Configuration - Public"])

# Private routes - admin only for web builder
webbuilder_config_private_router = APIRouter(prefix="/website", tags=["Web Builder Configuration - Private"])

#
# --- Public Routes ---
#

@webbuilder_config_public_router.get("/config")
async def get_website_config() -> Dict[str, Any]:
    """
    Get the current website configuration.
    
    Returns:
        Website configuration with title, favicon_url, etc.
    """
    return await WebbuilderConfigHelper.get_website_config()

#
# --- Private Routes (Admin/Website Builder) ---
#

@webbuilder_config_private_router.put("/config")
async def update_website_config(
    config_update: WebsiteConfigUpdate
) -> Dict[str, Any]:
    """
    Update website configuration.
    
    Args:
        config_update: Configuration updates (title, favicon_url, meta_description)
        
    Returns:
        Success message and updated configuration
    """
    try:
        # Convert to dict and remove None values
        updates = {k: v for k, v in config_update.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(status_code=400, detail="No valid updates provided")
        
        success = await WebbuilderConfigHelper.update_website_config(updates, updated_by="admin")
        
        if success:
            updated_config = await WebbuilderConfigHelper.get_website_config()
            return {
                "message": "Website configuration updated successfully",
                "config": updated_config
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update website configuration")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@webbuilder_config_private_router.post("/favicon")
async def upload_favicon(
    favicon: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Upload a new favicon file.
    
    Args:
        favicon: Favicon file (ICO, PNG, SVG)
        
    Returns:
        Success message with new favicon URL
    """
    try:
        # Validate file type
        allowed_types = ["image/x-icon", "image/png", "image/svg+xml", "image/ico"]
        if favicon.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
            )
        
        # Get configurable upload directory from environment variable
        # This allows different paths for development vs production
        upload_path = os.getenv("FAVICON_UPLOAD_PATH")
        
        if upload_path:
            # Production: Use absolute path from environment variable
            upload_dir = Path(upload_path)
        else:
            # Development: Default to frontend public directory (relative to project root)
            project_root = Path(__file__).parent.parent.parent  # Go up from backend/routes/
            upload_dir = project_root / "frontend" / "web" / "churchlink" / "public"
        
        # Ensure upload directory exists
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine file extension based on content type
        if favicon.content_type == "image/svg+xml":
            file_ext = "svg"
        elif favicon.content_type == "image/png":
            file_ext = "png"
        else:  # ICO files
            file_ext = "ico"
        
        # Save file with standard favicon name
        filename = f"favicon.{file_ext}"
        file_path = upload_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(favicon.file, buffer)
        
        # Build favicon URL - configurable for production (CDN, different domain, etc.)
        favicon_base_url = os.getenv("FAVICON_BASE_URL", "")  # Empty default for relative URLs
        if favicon_base_url:
            # Production: Use configured base URL (e.g., "https://cdn.yourdomain.com")
            favicon_url = f"{favicon_base_url.rstrip('/')}/{filename}"
        else:
            # Development: Use relative URL
            favicon_url = f"/{filename}"
        
        # Update website config with new favicon URL
        success = await WebbuilderConfigHelper.update_website_config(
            {"favicon_url": favicon_url}, 
            updated_by="admin"
        )
        
        if success:
            return {
                "message": "Favicon uploaded successfully",
                "favicon_url": favicon_url
            }
        else:
            # Clean up uploaded file if config update failed
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail="Failed to update favicon configuration")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload favicon: {str(e)}")

@webbuilder_config_private_router.put("/title")
async def update_website_title(
    title_request: TitleUpdateRequest
) -> Dict[str, Any]:
    """
    Update website title.
    
    Args:
        title_request: Request containing the new title
        
    Returns:
        Success message with updated title
    """
    try:
        success = await WebbuilderConfigHelper.update_website_config(
            {"title": title_request.title}, 
            updated_by="admin"
        )
        
        if success:
            return {
                "message": "Website title updated successfully",
                "title": title_request.title
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update website title")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update title: {str(e)}")

@webbuilder_config_private_router.get("/config/admin")
async def get_admin_website_config() -> Dict[str, Any]:
    """
    Get website configuration for admin interface.
    Includes additional metadata like updated_by, timestamps, etc.
    
    Returns:
        Complete website configuration with metadata
    """
    return await WebbuilderConfigHelper.get_website_config()
