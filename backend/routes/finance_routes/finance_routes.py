import os
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Body
from fastapi import status
from mongo.database import DB
from helpers.paypalHelper import get_paypal_access_token


# Create regular APIRouter that will be included in PermProtectedRouter
finance_router = APIRouter(
    prefix="/finance", 
    tags=["Finance"]
)

@finance_router.get("/paypal/status")
async def get_paypal_status(request: Request):
    """Get PayPal configuration status from environment variables"""
    try:
        # Check environment variables
        client_id = os.getenv("PAYPAL_CLIENT_ID", "")
        client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "")
        mode = os.getenv("PAYPAL_MODE", "sandbox")
        
        return {
            "success": True,
            "configured": bool(client_id and client_secret),
            "mode": mode,
            "client_id_set": bool(client_id),
            "client_secret_set": bool(client_secret),
            "message": "PayPal credentials are configured via environment variables"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@finance_router.get("/paypal/test-connection")
async def test_paypal_connection(request: Request):
    """Test PayPal API connection with current credentials"""
    try:
        
        # Try to get an access token using environment variables
        access_token = get_paypal_access_token()
        
        if access_token:
            return {
                "success": True,
                "message": "PayPal connection successful",
                "connected": True
            }
        else:
            return {
                "success": False,
                "message": "Failed to connect to PayPal API. Please check your credentials in the .env file.",
                "connected": False
            }
    
    except Exception as e:
        return {
            "success": False,
            "message": f"PayPal connection test failed: {str(e)}",
            "connected": False
        }

@finance_router.post("/paypal/credentials")
async def update_paypal_credentials_info(request: Request):
    """Information about updating PayPal credentials"""
    return {
        "success": False,
        "message": "PayPal credentials must be configured via environment variables (.env file). This ensures secure credential management.",
        "instructions": {
            "step1": "Open your .env file",
            "step2": "Add or update the following variables:",
            "variables": {
                "PAYPAL_CLIENT_ID": "Your PayPal Client ID from PayPal Developer Dashboard",
                "PAYPAL_CLIENT_SECRET": "Your PayPal Client Secret from PayPal Developer Dashboard", 
                "PAYPAL_MODE": "sandbox (for testing) or live (for production)"
            },
            "step3": "Restart the application to load the new credentials",
            "step4": "Use the test connection endpoint to verify the credentials work"
        }
    }

@finance_router.get("/paypal/settings")
async def get_paypal_settings(request: Request):
    """Get PayPal settings (non-credential settings stored in database)"""
    try:
        settings = await DB.get_paypal_settings()
        return {"success": True, "settings": settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@finance_router.post("/paypal/settings")
async def update_paypal_settings(
    request: Request,
    settings: Dict[str, Any] = Body(...)
):
    """Update PayPal settings (non-credential settings like church name, allowed funds)"""
    try:
        # Define which keys can be updated in the database
        # Credentials (PAYPAL_MODE, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
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
        
        return {
            "success": True,
            "message": "PayPal settings updated successfully",
            "updated": updated_settings
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update PayPal settings: {str(e)}")