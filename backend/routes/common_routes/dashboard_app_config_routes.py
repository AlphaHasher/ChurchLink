"""
Dashboard App Configuration Routes
Provides endpoints for getting and managing dashboard page configurations.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from helpers.DashboardAppConfigHelper import DashboardAppConfigHelper

# Public routes - accessible by Flutter app and other clients
dashboard_app_config_public_router = APIRouter(prefix="/app", tags=["App Configuration - Public"])

# Private routes - admin/management only
dashboard_app_config_private_router = APIRouter(prefix="/app", tags=["App Configuration - Private"])

#
# --- Public Routes ---
#

@dashboard_app_config_public_router.get("/dashboard/pages")
async def get_dashboard_pages() -> List[Dict[str, Any]]:
    config = await DashboardAppConfigHelper.get_config()
    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")
    return sorted(config.get("pages", []), key=lambda x: x.get("index", 0))


@dashboard_app_config_public_router.get("/dashboard/pages/{page_index}")
async def get_dashboard_page_by_index(page_index: int) -> Dict[str, Any]:
    page = await DashboardAppConfigHelper.get_page_by_index(page_index)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page with index {page_index} not found")
    return page


@dashboard_app_config_public_router.get("/dashboard/pages/name/{page_name}")
async def get_dashboard_page_by_name(page_name: str) -> Dict[str, Any]:
    config = await DashboardAppConfigHelper.get_config()
    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")
    page = next(
        (p for p in config.get("pages", []) if p.get("page_name", "").lower() == page_name.lower()),
        None
    )
    if not page:
        raise HTTPException(status_code=404, detail=f"Page with name '{page_name}' not found")
    return page


#
# --- Private Routes ---
#

@dashboard_app_config_private_router.post("/dashboard/pages")
async def save_dashboard_pages(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        success = await DashboardAppConfigHelper.save_config(pages, updated_by="admin")
        if success:
            return {"message": "Dashboard configuration saved successfully", "updated_by": "admin"}
        raise HTTPException(status_code=500, detail="Failed to save dashboard configuration")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@dashboard_app_config_private_router.put("/dashboard/pages/{page_index}")
async def update_dashboard_page(page_index: int, updates: Dict[str, Any]) -> Dict[str, Any]:
    try:
        success = await DashboardAppConfigHelper.update_page(page_index, updates, updated_by="admin")
        if success:
            return {"message": f"Dashboard page {page_index} updated successfully", "updated_by": "admin"}
        raise HTTPException(status_code=404, detail=f"Page with index {page_index} not found")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@dashboard_app_config_private_router.delete("/dashboard/pages/{page_index}")
async def delete_dashboard_page(page_index: int) -> Dict[str, Any]:
    success = await DashboardAppConfigHelper.delete_page(page_index, updated_by="admin")
    if success:
        return {"message": f"Dashboard page {page_index} deleted successfully", "deleted_by": "admin"}
    raise HTTPException(status_code=404, detail=f"Page with index {page_index} not found")


