# Bulk Registration Endpoint for Events with Combined Payment

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, Body, Query
from fastapi.responses import RedirectResponse
from bson import ObjectId
from protected_routers.auth_protected_router import AuthProtectedRouter
from helpers.event_payment_helper import event_payment_helper
from helpers.audit_logger import get_client_ip, get_user_agent
import json
import os
import traceback

# Import refund functionality
from models.refund_request import (
    RefundRequestCreate, 
    RefundRequestUpdate, 
    RefundRequestOut,
    RefundRequestStatus,
    create_refund_request,
    get_refund_request_by_id,
    get_refund_requests_by_user,
    get_refund_requests_by_event,
    update_refund_request,
    list_all_refund_requests
)
from helpers.paypalHelper import process_paypal_refund
import logging


# Create router instance
router = APIRouter()

event_payment_router = AuthProtectedRouter(prefix="/events", tags=["Event Payments"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

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
    
    # Process the payment completion and return the result as JSON
    result = await event_payment_helper.handle_paypal_success(
        event_id=event_id,
        payment_id=paymentId,
        payer_id=PayerID,
        token=token,
        client_ip=client_ip,
        request=request
    )
    
    return result


@event_payment_router.get("/{event_id}/payment/cancel")
async def handle_paypal_cancel(
    event_id: str,
    request: Request,
    token: str = None
):
    """Handle PayPal cancel redirect and cleanup pending payment"""
    client_ip = get_client_ip(request)
    
    try:
        # Process the cancellation in the helper
        result = await event_payment_helper.handle_paypal_cancel(
            event_id=event_id,
            token=token,
            client_ip=client_ip,
            request=request
        )
        
        # Redirect to the frontend cancel page with query parameters
        cancel_url = f"{FRONTEND_URL}/events/{event_id}/payment/cancel"
        if token:
            cancel_url += f"?token={token}"
            
        return RedirectResponse(url=cancel_url, status_code=302)
        
    except Exception as e:
        # If there's an error, still redirect to cancel page but with error info
        cancel_url = f"{FRONTEND_URL}/events/{event_id}/payment/cancel?error=true"
        return RedirectResponse(url=cancel_url, status_code=302)


# ===== REFUND ROUTES =====

@event_payment_router.post("/{event_id}/refund/request")
async def submit_refund_request(
    event_id: str,
    request: Request,
    refund_data: RefundRequestCreate
):
    """Submit a refund request for an event registration"""
    try:
        user_uid = getattr(request.state, 'uid', None)
        if not user_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        logging.info(f"Refund request submitted for event {event_id} by user {user_uid}")
        logging.info(f"Request data: {refund_data.model_dump()}")
        
        # Validate that the refund request is for the correct event
        if refund_data.event_id != event_id:
            raise HTTPException(status_code=400, detail="Event ID mismatch")
        
        # Create the refund request
        refund_request = await create_refund_request(refund_data, user_uid)
        
        if not refund_request:
            # Get more specific error information
            from mongo.database import DB
            from bson import ObjectId
            
            # Check if event exists
            event = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Check if user has any transactions for this event
            user_transactions = []
            async for tx in DB.db["transactions"].find({"event_id": event_id}):
                user_transactions.append({
                    "transaction_id": tx.get("transaction_id"),
                    "user_uid": tx.get("user_uid"),
                    "user_email": tx.get("user_email"),
                    "status": tx.get("status"),
                    "payment_type": tx.get("payment_type")
                })
            
            logging.error(f"Failed to create refund request. Available transactions: {user_transactions}")
            
            error_msg = "Unable to create refund request. "
            if not user_transactions:
                error_msg += "No payment transactions found for this event."
            else:
                completed_transactions = [tx for tx in user_transactions if tx.get("status") in ["completed", "paid"]]
                if not completed_transactions:
                    error_msg += "No completed payment transactions found for this event."
                else:
                    user_completed_transactions = [tx for tx in completed_transactions if tx.get("user_uid") == user_uid]
                    if not user_completed_transactions:
                        error_msg += "No completed payment transactions found for your account on this event."
                    else:
                        error_msg += "Payment found but refund request creation failed for technical reasons."
            
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Log the refund request
        client_ip = get_client_ip(request)
        logging.info(f"Refund request created successfully: {refund_request.request_id} by user {user_uid} from IP {client_ip}")
        
        return {
            "success": True,
            "request_id": refund_request.request_id,
            "status": refund_request.status,
            "message": "Refund request submitted successfully. You will receive email updates on the status."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error submitting refund request: {e}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to submit refund request")

@event_payment_router.get("/refund/my-requests")
async def get_my_refund_requests(request: Request):
    """Get all refund requests for the current user"""
    try:
        user_uid = getattr(request.state, 'uid', None)
        if not user_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_requests = await get_refund_requests_by_user(user_uid)
        
        return {
            "success": True,
            "refund_requests": [r.model_dump() for r in refund_requests],
            "total": len(refund_requests)
        }
        
    except Exception as e:
        logging.error(f"Error getting user refund requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve your refund requests")

@event_payment_router.get("/refund/request/{request_id}")
async def get_refund_request_details(
    request_id: str,
    request: Request
):
    """Get details of a specific refund request"""
    try:
        user_uid = getattr(request.state, 'uid', None)
        if not user_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_request = await get_refund_request_by_id(request_id)
        
        if not refund_request:
            raise HTTPException(status_code=404, detail="Refund request not found")
        
        # Users can only see their own requests
        if refund_request.user_uid != user_uid:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "success": True,
            "refund_request": refund_request.model_dump()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting refund request {request_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve refund request")