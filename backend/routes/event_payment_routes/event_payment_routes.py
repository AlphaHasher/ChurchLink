# Bulk Registration Endpoint for Events with Combined Payment

from typing import List, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Body
from bson import ObjectId
from protected_routers.auth_protected_router import AuthProtectedRouter
from helpers.event_payment_helper import event_payment_helper
from helpers.audit_logger import get_client_ip, get_user_agent
import json
import os
import traceback


# Create router instance
router = APIRouter()

event_payment_router = AuthProtectedRouter(prefix="/events", tags=["Event Payments"])


@event_payment_router.post("/{event_id}/payment/create-bulk-order")
async def create_bulk_event_payment_order(
    event_id: str,
    request: Request,
    bulk_data: Dict[str, Any] = Body(...)
):
    """Create PayPal payment order for multiple event registrations"""
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    return await event_payment_helper.create_bulk_payment_order(
        event_id=event_id,
        user_uid=request.state.uid,
        user=request.state.user,
        bulk_data=bulk_data,
        client_ip=client_ip,
        user_agent=user_agent
    )


@event_payment_router.post("/{event_id}/payment/complete-bulk-registration")
async def complete_bulk_event_registration(
    event_id: str,
    request: Request,
    completion_data: Dict[str, Any] = Body(...)
):
    """Complete bulk event registration after successful payment"""
    client_ip = get_client_ip(request)
    
    return await event_payment_helper.complete_bulk_registration(
        event_id=event_id,
        user_uid=request.state.uid,
        completion_data=completion_data,
        client_ip=client_ip
    )


@event_payment_router.get("/{event_id}/payment/status")
async def get_event_payment_status(
    event_id: str,
    request: Request
):
    """Get payment status summary for an event"""
    return await event_payment_helper.get_payment_status(
        event_id=event_id,
        user_uid=request.state.uid
    )


@event_payment_router.get("/{event_id}/registrations/payment-status")
async def get_event_registrations_by_payment_status(
    event_id: str,
    request: Request,
    payment_status: str = None
):
    """Get event registrations filtered by payment status"""
    return await event_payment_helper.get_registrations_by_payment_status(
        event_id=event_id,
        payment_status=payment_status
    )


@event_payment_router.post("/{event_id}/registrations/{registration_key}/payment-status")
async def update_registration_payment_status(
    event_id: str,
    registration_key: str,
    request: Request,
    status_data: Dict[str, Any] = Body(...)
):
    """Update payment status for a specific registration (admin only)"""
    return await event_payment_helper.update_registration_payment_status(
        event_id=event_id,
        registration_key=registration_key,
        status_data=status_data
    )


@event_payment_router.get("/{event_id}/payment/success")
async def handle_paypal_success(
    event_id: str,
    request: Request,
    paymentId: str = None,
    token: str = None,
    PayerID: str = None
):
    """Handle PayPal success redirect and complete payment"""
    client_ip = get_client_ip(request)
    
    if not paymentId or not PayerID:
        raise HTTPException(
            status_code=400, 
            detail="Missing required PayPal parameters (paymentId and PayerID)"
        )
    
    return await event_payment_helper.handle_paypal_success(
        event_id=event_id,
        payment_id=paymentId,
        payer_id=PayerID,
        token=token,
        client_ip=client_ip,
        request=request
    )


@event_payment_router.get("/{event_id}/payment/cancel")
async def handle_paypal_cancel(
    event_id: str,
    request: Request,
    token: str = None
):
    """Handle PayPal cancel redirect and cleanup pending payment"""
    client_ip = get_client_ip(request)
    
    return await event_payment_helper.handle_paypal_cancel(
        event_id=event_id,
        token=token,
        client_ip=client_ip,
        request=request
    )