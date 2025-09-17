from fastapi import APIRouter, Query, Body, HTTPException
from typing import Optional, Dict, Any
from helpers.paypalHelper import (
    update_transaction_status_api as paypal_update_transaction_status,
    get_transaction_by_id as paypal_get_transaction_by_id,
    list_all_transactions as paypal_list_all_transactions,
    get_all_subscriptions_helper as paypal_get_all_subscriptions_helper
)
from mongo.database import DB

paypal_router = APIRouter(prefix="/paypal_admin", tags=["paypal-admin"])

# ------------------------------------------------------------------------------
# Endpoint to Update Transaction Status (refund/cancel/etc)
# ------------------------------------------------------------------------------
@paypal_router.post("/transaction/{transaction_id}/status", status_code=200)
async def update_transaction_status(
    transaction_id: str, 
    status: str = Body(...), 
    reason: Optional[str] = Body(None)
):
    return await paypal_update_transaction_status(transaction_id, status, reason)

# ------------------------------------------------------------------------------
# Admin Dashboard: List All Transactions
# ------------------------------------------------------------------------------
@paypal_router.get("/admin/transactions", status_code=200)
async def list_all_transactions(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(20, description="Maximum number of records to return"),
    fund_name: Optional[str] = Query(None, description="Filter by fund name"),
    status: Optional[str] = Query(None, description="Filter by transaction status")
):
    return await paypal_list_all_transactions(skip, limit, fund_name, status)

# ------------------------------------------------------------------------------
# Endpoint to Get Transaction by transaction_id
# ------------------------------------------------------------------------------
@paypal_router.get("/transaction/{transaction_id}", status_code=200)
async def get_transaction_by_id(transaction_id: str):
    return await paypal_get_transaction_by_id(transaction_id)

# ------------------------------------------------------------------------------
# Admin Dashboard: List All Subscriptions
# ------------------------------------------------------------------------------
@paypal_router.get("/admin/subscriptions", status_code=200)
async def get_all_subscriptions(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(20, description="Maximum number of records to return"),
    status: Optional[str] = Query(None, description="Filter by subscription status"),
    fund_name: Optional[str] = Query(None, description="Filter by fund name")
):
    return await paypal_get_all_subscriptions_helper(skip, limit, status, fund_name)

# ------------------------------------------------------------------------------
# PayPal Settings Management Endpoints (ADMIN ONLY
# ------------------------------------------------------------------------------
@paypal_router.get("/settings")
async def get_paypal_settings():
    """Get PayPal settings for the admin dashboard"""
    try:
        settings = await DB.get_paypal_settings()
        return {"settings": settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@paypal_router.post("/settings")
async def update_paypal_settings(
    settings: Dict[str, Any] = Body(...)
):
    """Update PayPal settings in the database"""
    try:
        # Define which keys can be updated in the database
        # Environment variables (PAYPAL_MODE, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
        # are kept in .env file and cannot be updated through the API
        allowed_keys = [
            "PAYPAL_PLAN_NAME", 
            "PAYPAL_PLAN_DESCRIPTION", 
            "CHURCH_NAME",
            "ALLOWED_FUNDS"
        ]
        
        # Update each setting in the database
        updated_settings = {}
        for key, value in settings.items():
            if key in allowed_keys:
                # For ALLOWED_FUNDS, handle as a list
                if key == "ALLOWED_FUNDS":
                    # If value is a string (comma-separated), convert to list
                    if isinstance(value, str):
                        value = [item.strip() for item in value.split(",") if item.strip()]
                    # If already a list, use as is
                    elif isinstance(value, list):
                        value = [str(item).strip() for item in value if str(item).strip()]
                
                success = await DB.set_setting(key, value)
                if success:
                    updated_settings[key] = value
        
        # Return the updated settings
        return {
            "success": True,
            "updated_settings": updated_settings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@paypal_router.get("/settings/{key}")
async def get_setting(key: str):
    """Get a specific setting value"""
    try:
        value = await DB.get_setting(key)
        if value is None:
            raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
        return {"key": key, "value": value}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@paypal_router.post("/settings/{key}")
async def update_setting(
    key: str, 
    value: Dict[str, Any] = Body(...)
):
    """Update a specific setting value"""
    try:
        if "value" not in value:
            raise HTTPException(status_code=400, detail="Request body must contain a 'value' field")
        
        success = await DB.set_setting(key, value["value"])
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to update setting '{key}'")
        
        return {"success": True, "key": key, "value": value["value"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))