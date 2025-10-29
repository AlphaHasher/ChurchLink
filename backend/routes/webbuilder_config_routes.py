"""
Web Builder Configuration Routes
Provides endpoints for managing website configuration like favicon, title, etc.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from helpers.WebbuilderConfigHelper import WebbuilderConfigHelper
from models.website_app_config import WebsiteConfigUpdate, TitleUpdateRequest

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
        updates = {k: v for k, v in config_update.model_dump().items() if v is not None}
        
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
       raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") from e

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
