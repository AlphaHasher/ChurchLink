"""
App Configuration Routes
Provides endpoints for getting and managing app configuration like tab structure
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from helpers.AppConfigHelper import AppConfigHelper

# Public routes - accessible by Flutter app and other clients
app_config_public_router = APIRouter(prefix="/app", tags=["App Configuration - Public"])

# Private routes - admin/management only
app_config_private_router = APIRouter(prefix="/app", tags=["App Configuration - Private"])

#
# --- Public Routes ---
#

@app_config_public_router.get("/tabs")
async def get_app_tabs() -> List[Dict[str, Any]]:
    """
    Get the current tab structure of the Flutter app.
    
    Returns:
        List of tab configurations with index, name, displayName, icon, and enabled status
    """
    return await AppConfigHelper.get_tab_configuration()

@app_config_public_router.get("/tabs/{tab_index}")
async def get_tab_by_index(tab_index: int) -> Dict[str, Any]:
    """
    Get a specific tab by its index.
    
    Args:
        tab_index: The tab index (0-4)
        
    Returns:
        Tab configuration object
        
    Raises:
        404: If tab index is not found
    """
    tab = await AppConfigHelper.get_tab_by_index(tab_index)
    if not tab:
        raise HTTPException(status_code=404, detail=f"Tab with index {tab_index} not found")
    
    return tab

@app_config_public_router.get("/tabs/name/{tab_name}")
async def get_tab_by_name(tab_name: str) -> Dict[str, Any]:
    """
    Get a specific tab by its name.
    
    Args:
        tab_name: The tab name (home, bible, sermons, events, profile)
        
    Returns:
        Tab configuration object
        
    Raises:
        404: If tab name is not found
    """
    tab = await AppConfigHelper.get_tab_by_name(tab_name)
    if not tab:
        raise HTTPException(status_code=404, detail=f"Tab with name '{tab_name}' not found")
    
    return tab

#
# --- Private Routes ---
#

@app_config_private_router.post("/tabs")
async def save_tabs(
    tabs: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Save/update the entire tab configuration.
    
    Args:
        tabs: List of tab configurations
        
    Returns:
        Success/failure message
    """
    try:
        # Validate maximum tab limit
        if len(tabs) > 5:
            raise HTTPException(
                status_code=400, 
                detail=f"Maximum 5 tabs allowed due to Flutter BottomNavigationBar limitations. Received {len(tabs)} tabs."
            )
        
        success = await AppConfigHelper.save_tab_configuration(tabs, updated_by="admin")
        
        if success:
            return {"message": "Tab configuration saved successfully", "updated_by": "admin"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save tab configuration")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Log the error for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app_config_private_router.put("/tabs/{tab_index}")
async def update_tab(
    tab_index: int,
    updates: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Update a specific tab.
    
    Args:
        tab_index: Index of tab to update
        updates: Fields to update
        
    Returns:
        Success/failure message
    """
    success = await AppConfigHelper.update_tab(tab_index, updates, updated_by="admin")
    
    if success:
        return {"message": f"Tab {tab_index} updated successfully", "updated_by": "admin"}
    else:
        raise HTTPException(status_code=404, detail=f"Tab with index {tab_index} not found")

@app_config_private_router.delete("/tabs/{tab_index}")
async def delete_tab(
    tab_index: int
) -> Dict[str, Any]:
    """
    Delete a specific tab.
    
    Args:
        tab_index: Index of tab to delete
        
    Returns:
        Success/failure message
    """
    success = await AppConfigHelper.delete_tab(tab_index, updated_by="admin")
    
    if success:
        return {"message": f"Tab {tab_index} deleted successfully", "deleted_by": "admin"}
    else:
        raise HTTPException(status_code=404, detail=f"Tab with index {tab_index} not found")