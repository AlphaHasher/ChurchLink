# TODO: UNBORK THIS

'''
from fastapi import APIRouter, HTTPException, Request, Body, Query
from typing import Optional, List, Dict, Any
from models.refund_request import (
    RefundRequestCreate, 
    RefundRequestUpdate, 
    RefundRequestOut,
    create_refund_request,
    get_refund_request_by_id,
    get_refund_requests_by_user,
    get_refund_requests_by_event,
    update_refund_request,
    list_all_refund_requests
)
from models.transaction import RefundStatus
from helpers.audit_logger import get_client_ip
from helpers.paypalHelper import process_paypal_refund
from helpers.RefundEmailHelper import (
    send_refund_request_confirmation,
    send_admin_refund_alert
)
import logging
import os
from models.user import get_user_by_uid
from mongo.database import DB
from bson import ObjectId

refund_router = APIRouter(prefix="/events", tags=["Event Refunds"])

@refund_router.post("/{event_id}/refund/request")
async def submit_refund_request(
    event_id: str,
    request: Request,
    refund_data: RefundRequestCreate
):
    """Submit a refund request for an event registration"""
    try:
        user_uid = getattr(request.state, 'current_user_uid', None)
        if not user_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Validate that the refund request is for the correct event
        if refund_data.event_id != event_id:
            raise HTTPException(status_code=400, detail="Event ID mismatch")
        
        # Create the refund request
        refund_request = await create_refund_request(refund_data, user_uid)
        
        if not refund_request:
            raise HTTPException(
                status_code=400, 
                detail="Unable to create refund request. Please ensure you have a completed payment for this event."
            )
        
        # Log the refund request
        client_ip = get_client_ip(request)
        logging.info(f"Refund request created: {refund_request.request_id} by user {user_uid} from IP {client_ip}")
        
        # Send email notifications
        try:
            # Get user email from Firebase
            user_data = await get_user_by_uid(user_uid)
            user_email = user_data.email if user_data else None
            user_name = f"{user_data.first_name} {user_data.last_name}" if user_data else refund_request.display_name
            
            # Get event details
            event_doc = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
            event_name = event_doc.get('name', 'Unknown Event') if event_doc else 'Unknown Event'
            
            # Send confirmation email to user
            if user_email:
                await send_refund_request_confirmation(
                    to_email=user_email,
                    user_name=user_name,
                    event_name=event_name,
                    amount=refund_request.payment_amount,
                    request_id=refund_request.request_id
                )
                logging.info(f"Refund confirmation email sent to {user_email}")
            
            # Send alert to admins
            admin_emails = os.getenv("ADMIN_EMAILS", "").split(",")
            admin_emails = [email.strip() for email in admin_emails if email.strip()]
            
            if admin_emails:
                await send_admin_refund_alert(
                    admin_emails=admin_emails,
                    user_name=user_name,
                    event_name=event_name,
                    amount=refund_request.payment_amount,
                    request_id=refund_request.request_id,
                    reason=refund_request.reason
                )
                logging.info(f"Refund admin alerts sent to {len(admin_emails)} admins")
                
        except Exception as e:
            # Don't fail the refund request if email fails
            logging.error(f"Failed to send refund notification emails: {e}")
        
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
        raise HTTPException(status_code=500, detail="Failed to submit refund request")

@refund_router.get("/{event_id}/refund/requests")
async def get_event_refund_requests(
    event_id: str,
    request: Request,
    status: Optional[str] = Query(None, description="Filter by status")
):
    """Get all refund requests for an event (admin only)"""
    try:
        # This endpoint should be admin-protected in your route inclusion
        refund_requests = await get_refund_requests_by_event(event_id)
        
        # Filter by status if provided
        if status:
            refund_requests = [r for r in refund_requests if r.status == status]
        
        return {
            "success": True,
            "refund_requests": [r.model_dump() for r in refund_requests],
            "total": len(refund_requests)
        }
        
    except Exception as e:
        logging.error(f"Error getting refund requests for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve refund requests")

@refund_router.get("/refund/my-requests")
async def get_my_refund_requests(request: Request):
    """Get all refund requests for the current user"""
    try:
        user_uid = getattr(request.state, 'current_user_uid', None)
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

@refund_router.get("/refund/request/{request_id}")
async def get_refund_request_details(
    request_id: str,
    request: Request
):
    """Get details of a specific refund request"""
    try:
        user_uid = getattr(request.state, 'current_user_uid', None)
        if not user_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_request = await get_refund_request_by_id(request_id)
        
        if not refund_request:
            raise HTTPException(status_code=404, detail="Refund request not found")
        
        # Users can only see their own requests (unless admin - implement role check)
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

# Admin routes (should be included in admin-protected router)
@refund_router.post("/refund/request/{request_id}/process")
async def process_refund_request(
    request_id: str,
    request: Request,
    process_data: Dict[str, Any] = Body(...)
):
    """Process a refund request (approve/reject) - Admin only"""
    try:
        admin_uid = getattr(request.state, 'current_user_uid', None)
        if not admin_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_request = await get_refund_request_by_id(request_id)
        if not refund_request:
            raise HTTPException(status_code=404, detail="Refund request not found")
        
        # Guard idempotency: only allow processing of pending requests
        # Valid transition: "pending" → process (approve/reject)
        action = (process_data or {}).get("action")
        action_str = action if action in {"approve","reject"} else "process"
        if refund_request.status in {RefundStatus.APPROVED, RefundStatus.PROCESSING, RefundStatus.COMPLETED, RefundStatus.REJECTED, RefundStatus.CANCELLED}:
            raise HTTPException(status_code=409, detail=f"Cannot {action_str} a request in status '{refund_request.status}'")
        
        action = process_data.get("action")  # "approve" or "reject"
        admin_notes = process_data.get("admin_notes", "")
        
        if action not in ["approve", "reject"]:
            raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
        
        # Update refund request status
        new_status = RefundStatus.APPROVED if action == "approve" else RefundStatus.REJECTED
        
        updates = RefundRequestUpdate(
            status=new_status,
            admin_notes=admin_notes
        )
        
        # Add admin info
        updates.processed_by = admin_uid
        
        success = await update_refund_request(request_id, updates)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update refund request")
        
        # If approved, initiate PayPal refund
        if action == "approve":
            try:
                paypal_result = await process_paypal_refund(
                    transaction_id=refund_request.transaction_id,
                    refund_amount=refund_request.payment_amount,
                    reason=f"Event refund: {refund_request.reason}"
                )
                
                if paypal_result.get("success"):
                    # Update with PayPal refund details
                    await update_refund_request(request_id, RefundRequestUpdate(
                        status=RefundStatus.PROCESSING,
                        paypal_refund_id=paypal_result.get("refund_id"),
                        paypal_refund_status=paypal_result.get("status")
                    ))
                else:
                    # PayPal refund failed, update status
                    await update_refund_request(request_id, RefundRequestUpdate(
                        status=RefundStatus.PENDING,
                        admin_notes=f"{admin_notes}\n\nPayPal refund failed: {paypal_result.get('error', 'Unknown error')}"
                    ))
                    
            except Exception as e:
                logging.error(f"PayPal refund failed for request {request_id}: {e}")
                await update_refund_request(request_id, RefundRequestUpdate(
                    admin_notes=f"{admin_notes}\n\nPayPal refund failed: {str(e)}"
                ))
        
        # Send notification to user
        # await send_refund_decision_notification(refund_request, action, admin_notes)
        
        return {
            "success": True,
            "action": action,
            "status": new_status,
            "message": f"Refund request {action}d successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing refund request {request_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process refund request")

@refund_router.get("/refund/requests/all")
async def list_all_refund_requests_admin(
    request: Request,
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(50, description="Maximum number of records to return"),
    status: Optional[str] = Query(None, description="Filter by status"),
    event_id: Optional[str] = Query(None, description="Filter by event ID")
):
    """List all refund requests with pagination - Admin only"""
    try:
        refund_requests = await list_all_refund_requests(
            skip=skip,
            limit=limit,
            status=status,
            event_id=event_id
        )
        
        return {
            "success": True,
            "refund_requests": [r.model_dump() for r in refund_requests],
            "total": len(refund_requests),
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logging.error(f"Error listing refund requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to list refund requests")
'''