"""
Dashboard App Configuration Routes
Provides endpoints for getting and managing dashboard page configurations.
"""

from fastapi import APIRouter, HTTPException, Request
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


@dashboard_app_config_private_router.get("/dashboard/pages/user")
async def get_user_dashboard_pages(request: Request) -> List[Dict[str, Any]]:
    """Get dashboard pages with access level indicators (full access, view-only, or hidden)"""
    config = await DashboardAppConfigHelper.get_config()
    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")
    
    pages = config.get("pages", [])
    
    # Get user from request state and compute permissions
    user = getattr(request.state, 'user', None)
    if not user:
        # No user - return empty permissions
        user_perms = {}
    else:
        user_roles = user.get('roles', [])
        if not user_roles:
            # Import here to avoid circular imports
            from mongo.roles import RoleHandler
            user_perms = RoleHandler.permission_template.copy()
        else:
            from mongo.roles import RoleHandler
            user_perms = await RoleHandler.infer_permissions(user_roles)
    
    # Define which pages require which permissions for full access
    permission_mapping = {
        'finance': 'finance',
        'giving': 'finance',
        'weekly-bulletin': 'bulletin_editing',
        'bulletins': 'bulletin_editing',
        'sermons': 'sermon_editing',
        'events': 'event_editing',
        'permissions': 'permissions_management',
        'users': 'permissions_management',
        'admin': 'admin',
        'webbuilder': 'web_builder_management',
        'mobile-ui-tab': 'mobile_ui_management',
        'mobile-ui-pages': 'mobile_ui_management',
        'mobile-ui': 'mobile_ui_management',
        'media': 'media_management',
        'notifications': 'notification_management',
        'ministries': 'ministries_management',
        'bible-plans': 'bible_plan_management',
        'bible-plan': 'bible_plan_management',
        'forms': 'forms_management',
        'form': 'forms_management',
    }
    
    # Always public pages (everyone has full access)
    public_pages = ['profile', 'home', 'join-live', 'forms', 'bible']
    
    # Process all pages with access level indicators
    processed_pages = []
    is_admin = user_perms.get('admin', False)
    
    for page in pages:
        page_copy = page.copy()  # Don't modify original
        page_name = page.get('pageName', '').lower().replace(' ', '-').replace('_', '-')
        display_name = page.get('displayName', '').lower().replace(' ', '-').replace('_', '-')
        
        # Check if this is a public page
        is_public = any(public_page in page_name or public_page in display_name for public_page in public_pages)
        
        if is_public:
            # Public pages - everyone has full access
            page_copy['accessLevel'] = 'full'
            page_copy['canEdit'] = True
            page_copy['canView'] = True
            processed_pages.append(page_copy)
            continue
        
        # Find required permission for this page
        required_permission = None
        for key in permission_mapping:
            if key in page_name or key in display_name:
                required_permission = permission_mapping[key]
                break
        
        if required_permission is None:
            # No specific permission mapping found - treat as public
            page_copy['accessLevel'] = 'full'
            page_copy['canEdit'] = True
            page_copy['canView'] = True
        elif is_admin:
            # Admin users have full access to everything
            page_copy['accessLevel'] = 'full'
            page_copy['canEdit'] = True
            page_copy['canView'] = True
        elif user_perms.get(required_permission, False):
            # User has the required permission - full access
            page_copy['accessLevel'] = 'full'
            page_copy['canEdit'] = True
            page_copy['canView'] = True
        else:
            # User doesn't have permission - skip this page entirely
            continue
        
        processed_pages.append(page_copy)
    
    return sorted(processed_pages, key=lambda x: x.get("index", 0))


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


