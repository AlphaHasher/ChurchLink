"""
Dashboard App Configuration Routes
Handles endpoints for managing dashboard page configurations
stored in the shared 'app_config' MongoDB collection.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from helpers.DashboardAppConfigHelper import DashboardAppConfigHelper

# Public routes - accessible by Flutter app and other clients
dashboard_app_config_public_router = APIRouter(
    prefix="/app",
    tags=["App Configuration - Public"]
)

# Private routes - admin/management only
dashboard_app_config_private_router = APIRouter(
    prefix="/app",
    tags=["App Configuration - Private"]
)

#
# --- Public Routes ---
#

@dashboard_app_config_public_router.get("/dashboard/pages")
async def get_dashboard_pages() -> List[Dict[str, Any]]:
    """
    Get the current dashboard page configuration.

    Returns:
        List of page configurations with index, page_name, display_name, image_id, and enabled status
    """
    config = await DashboardAppConfigHelper.get_config()
    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")

    # Sort pages by index for consistent order
    pages = sorted(config.get("pages", []), key=lambda x: x.get("index", 0))
    return pages


@dashboard_app_config_public_router.get("/dashboard/pages/{page_index}")
async def get_dashboard_page_by_index(page_index: int) -> Dict[str, Any]:
    """
    Get a specific dashboard page by its index.

    Args:
        page_index: The page index (0-based)

    Returns:
        Page configuration object
    """
    page = await DashboardAppConfigHelper.get_page_by_index(page_index)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page with index {page_index} not found")
    return page


@dashboard_app_config_public_router.get("/dashboard/pages/name/{page_name}")
async def get_dashboard_page_by_name(page_name: str) -> Dict[str, Any]:
    """
    Get a specific dashboard page by its name.

    Args:
        page_name: The page name (e.g., 'overview', 'analytics')

    Returns:
        Page configuration object
    """
    config = await DashboardAppConfigHelper.get_config()
    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")

    pages = config.get("pages", [])
    page = next((p for p in pages if p.get("page_name", "").lower() == page_name.lower()), None)

    if not page:
        raise HTTPException(status_code=404, detail=f"Page with name '{page_name}' not found")
    return page


#
# --- Private Routes ---
#

@dashboard_app_config_private_router.post("/dashboard/pages")
async def save_dashboard_pages(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Save or replace the entire dashboard page configuration.

    Args:
        pages: List of page configurations

    Returns:
        Success/failure message
    """
    try:
        # Validate maximum number of pages (optional — you can adjust this)
        if len(pages) > 10:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum 10 pages allowed. Received {len(pages)} pages."
            )

        success = await DashboardAppConfigHelper.save_config(pages, updated_by="admin")

        if success:
            return {"message": "Dashboard page configuration saved successfully", "updated_by": "admin"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save dashboard configuration")

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@dashboard_app_config_private_router.put("/dashboard/pages/{page_index}")
async def update_dashboard_page(page_index: int, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a specific dashboard page.

    Args:
        page_index: Index of page to update
        updates: Fields to update

    Returns:
        Success/failure message
    """
    success = await DashboardAppConfigHelper.update_page(page_index, updates, updated_by="admin")

    if success:
        return {"message": f"Dashboard page {page_index} updated successfully", "updated_by": "admin"}
    else:
        raise HTTPException(status_code=404, detail=f"Page with index {page_index} not found")


@dashboard_app_config_private_router.delete("/dashboard/pages/{page_index}")
async def delete_dashboard_page(page_index: int) -> Dict[str, Any]:
    """
    Delete a specific dashboard page.

    Args:
        page_index: Index of page to delete

    Returns:
        Success/failure message
    """
    success = await DashboardAppConfigHelper.delete_page(page_index, updated_by="admin")

    if success:
        return {"message": f"Dashboard page {page_index} deleted successfully", "deleted_by": "admin"}
    else:
        raise HTTPException(status_code=404, detail=f"Page with index {page_index} not found")

