"""
Web Builder Configuration Routes
Provides endpoints for managing website configuration like favicon, title, etc.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any, Optional
from helpers.WebbuilderConfigHelper import WebbuilderConfigHelper
from pydantic import BaseModel
import os
import shutil
from pathlib import Path

# Pydantic models for request validation
class WebsiteConfigUpdate(BaseModel):
    title: Optional[str] = None
    favicon_url: Optional[str] = None
    meta_description: Optional[str] = None

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
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("/Applications/Git/SSBC-Hub/frontend/web/churchlink/public")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine file extension
        file_ext = "svg" if favicon.content_type == "image/svg+xml" else "ico"
        if favicon.content_type == "image/png":
            file_ext = "png"
        
        # Save file
        filename = f"favicon.{file_ext}"
        file_path = upload_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(favicon.file, buffer)
        
        # Update website config with new favicon URL
        favicon_url = f"/{filename}"
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
    title_data: Dict[str, str]
) -> Dict[str, Any]:
    """
    Update website title.
    
    Args:
        title_data: Dictionary containing 'title' field
        
    Returns:
        Success message with updated title
    """
    try:
        title = title_data.get("title")
        if not title or not title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        
        success = await WebbuilderConfigHelper.update_website_config(
            {"title": title.strip()}, 
            updated_by="admin"
        )
        
        if success:
            return {
                "message": "Website title updated successfully",
                "title": title.strip()
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
