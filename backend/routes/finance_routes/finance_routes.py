import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, Body, Query
from fastapi import status
from mongo.database import DB
from helpers.finance_helper import finance_helper
from helpers.audit_logger import get_client_ip

# Create regular APIRouter that will be included in PermProtectedRouter
finance_router = APIRouter(
    prefix="/finance", 
    tags=["Finance"]
)

@finance_router.get("/paypal/status")
async def get_paypal_status(request: Request):
    """Get PayPal configuration status from environment variables"""
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_paypal_status(
        user_id=user_id,
        request_ip=request_ip
    )

@finance_router.get("/paypal/test-connection")
async def test_paypal_connection(request: Request):
    """Test PayPal API connection with current credentials"""
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.test_paypal_connection(
        user_id=user_id,
        request_ip=request_ip
    )

@finance_router.post("/paypal/credentials")
async def update_paypal_credentials_info(request: Request):
    """Information about updating PayPal credentials"""
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_paypal_credentials_info(
        user_id=user_id,
        request_ip=request_ip
    )

@finance_router.get("/paypal/settings")
async def get_paypal_settings(request: Request):
    """Get PayPal settings (non-credential settings stored in database)"""
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_paypal_settings(
        user_id=user_id,
        request_ip=request_ip
    )

@finance_router.post("/paypal/settings")
async def update_paypal_settings(
    request: Request,
    settings: Dict[str, Any] = Body(...)
):
    """Update PayPal settings (non-credential settings like church name, allowed funds)"""
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.update_paypal_settings(
        user_id=user_id,
        settings=settings,
        request_ip=request_ip
    )

# =============================================================================
# COMPREHENSIVE TRANSACTION DETAIL ENDPOINTS
# =============================================================================

@finance_router.get("/transactions")
async def get_all_transactions(
    request: Request,
    skip: int = Query(0, description="Number of records to skip for pagination"),
    limit: int = Query(20, description="Maximum number of records to return"),
    payment_type: Optional[str] = Query(None, description="Filter by payment type: donation, event_registration, form_submission"),
    status: Optional[str] = Query(None, description="Filter by transaction status"),
    start_date: Optional[str] = Query(None, description="Start date for filtering (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (YYYY-MM-DD)"),
    event_id: Optional[str] = Query(None, description="Filter by specific event ID"),
    form_id: Optional[str] = Query(None, description="Filter by specific form ID"),
    user_email: Optional[str] = Query(None, description="Filter by user email")
):
    """
    Get comprehensive transaction details across all payment types with advanced filtering.
    Supports event payments, form payments, and PayPal donations.
    """
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_all_transactions(
        user_id=user_id,
        skip=skip,
        limit=limit,
        payment_type=payment_type,
        status=status,
        start_date=start_date,
        end_date=end_date,
        event_id=event_id,
        form_id=form_id,
        user_email=user_email,
        request_ip=request_ip
    )

@finance_router.get("/transactions/{transaction_id}")
async def get_transaction_detail(
    request: Request,
    transaction_id: str
):
    """
    Get detailed information for a specific transaction including related data.
    """
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_transaction_detail(
        user_id=user_id,
        transaction_id=transaction_id,
        request_ip=request_ip
    )

@finance_router.get("/analytics/summary")
async def get_financial_summary(
    request: Request,
    start_date: Optional[str] = Query(None, description="Start date for analysis (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for analysis (YYYY-MM-DD)"),
    period: Optional[str] = Query("month", description="Analysis period: day, week, month, year")
):
    """
    Get comprehensive financial analytics and summary across all payment types.
    """
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_financial_summary(
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        period=period,
        request_ip=request_ip
    )

@finance_router.get("/analytics/events")
async def get_event_financial_analytics(
    request: Request,
    event_id: Optional[str] = Query(None, description="Specific event ID to analyze"),
    start_date: Optional[str] = Query(None, description="Start date for filtering (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (YYYY-MM-DD)")
):
    """
    Get detailed financial analytics for event payments.
    """
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_event_financial_analytics(
        user_id=user_id,
        event_id=event_id,
        start_date=start_date,
        end_date=end_date,
        request_ip=request_ip
    )

@finance_router.get("/analytics/forms")
async def get_form_financial_analytics(
    request: Request,
    form_id: Optional[str] = Query(None, description="Specific form ID to analyze"),
    start_date: Optional[str] = Query(None, description="Start date for filtering (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (YYYY-MM-DD)")
):
    """
    Get detailed financial analytics for form payments.
    """
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    request_ip = get_client_ip(request)
    
    return await finance_helper.get_form_financial_analytics(
        user_id=user_id,
        form_id=form_id,
        start_date=start_date,
        end_date=end_date,
        request_ip=request_ip
    )
