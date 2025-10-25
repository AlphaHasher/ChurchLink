from fastapi import APIRouter, HTTPException, Request, Body, Query
from typing import Optional, List, Dict, Any
import os
import logging

from datetime import datetime
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
    list_all_refund_requests,
    populate_missing_event_names, 
    validate_refund_amount, 
    calculate_refund_options, 
    get_refund_summary
)
from helpers.paypalHelper import process_paypal_refund
from helpers.RefundEmailHelper import (
    send_refund_approved_notification,
    send_refund_completed_notification,
    send_refund_rejected_notification
)
import logging
from controllers.assets_controller import get_image_by_id
from mongo.database import DB
from bson import ObjectId
from models.user import get_user_by_uid
from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url
import requests

# Helper function to resolve proof URLs
async def resolve_proof_url(refund_request) -> Optional[str]:
    """Resolve proof image ID to public URL"""
    if not hasattr(refund_request, 'manual_refund_proof_image_id') or not refund_request.manual_refund_proof_image_id:
        return None
    try:
        # Import here to avoid circular imports and handle gracefully
        proof_asset = await get_image_by_id(refund_request.manual_refund_proof_image_id)
        return proof_asset.public_url if proof_asset else None
    except ImportError as e:
        logging.warning(f"Could not import assets controller for proof URL resolution: {e}")
        # Fallback: construct URL manually using the asset ID
        base_url = os.getenv("BACKEND_URL", "").rstrip('/')
        return f"{base_url}/api/v1/assets/public/id/{refund_request.manual_refund_proof_image_id}" if base_url else f"/api/v1/assets/public/id/{refund_request.manual_refund_proof_image_id}"
    except Exception as e:
        logging.error(f"Error resolving proof URL: {e}")
        return None

async def create_refund_out(refund_request) -> RefundRequestOut:
    """Create RefundRequestOut with proof URL resolved"""
    proof_url = await resolve_proof_url(refund_request)
    data = refund_request.model_dump() if hasattr(refund_request, 'model_dump') else refund_request.dict()
    return RefundRequestOut(**data, proof_url=proof_url)

def add_system_log(current_notes: Optional[str], log_message: str) -> str:
    """Add a system log entry without overwhelming the admin notes"""
    timestamp = datetime.utcnow().isoformat()[:19] + "Z"
    new_log = f"[{timestamp}] {log_message}"
    
    if not current_notes:
        return new_log
    
    # If we already have many system logs, just keep the most recent ones
    lines = current_notes.split('\n')
    system_log_lines = [line for line in lines if line.startswith('[')]
    manual_notes_lines = [line for line in lines if not line.startswith('[') and not line.startswith('---')]
    
    # Keep only the last 3 system logs to prevent overwhelming
    if len(system_log_lines) >= 3:
        system_log_lines = system_log_lines[-2:]  # Keep only last 2, add new one
    
    system_log_lines.append(new_log)
    
    # Combine manual notes and recent system logs
    all_lines = manual_notes_lines + system_log_lines
    return '\n'.join(line for line in all_lines if line.strip())

async def get_user_and_event_details(refund_request):
    """Get user and event details for email notifications"""
    try:
        # Get user email from Firebase
        user_data = await get_user_by_uid(refund_request.user_uid)
        user_email = user_data.email if user_data else None
        user_name = f"{user_data.first_name} {user_data.last_name}" if user_data else refund_request.display_name
        
        # Get event details
        event_doc = await DB.db["events"].find_one({"_id": ObjectId(refund_request.event_id)})
        event_name = event_doc.get('name', 'Unknown Event') if event_doc else 'Unknown Event'
        
        return {
            "user_email": user_email,
            "user_name": user_name,
            "event_name": event_name
        }
    except Exception as e:
        logging.error(f"Failed to get user/event details for email: {e}")
        return {
            "user_email": None,
            "user_name": refund_request.display_name,
            "event_name": "Unknown Event"
        }

admin_refund_router = APIRouter(prefix="/events", tags=["Admin Refund Management"])

@admin_refund_router.get("/{event_id}/refund/requests")
async def get_event_refund_requests(
    event_id: str,
    request: Request,
    status: Optional[str] = Query(None, description="Filter by status")
):
    """Get all refund requests for an event (admin only)"""
    try:
        refund_requests = await get_refund_requests_by_event(event_id)
        
        # Filter by status if provided
        if status:
            refund_requests = [r for r in refund_requests if r.status == status]
        
        # Convert to RefundRequestOut with proof URLs
        refund_requests_out = []
        for refund_request in refund_requests:
            refund_out = await create_refund_out(refund_request)
            refund_requests_out.append(refund_out.model_dump())
        
        return {
            "success": True,
            "refund_requests": refund_requests_out,
            "total": len(refund_requests_out)
        }
        
    except Exception as e:
        logging.error(f"Error getting refund requests for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve refund requests")

@admin_refund_router.post("/refund/request/{request_id}/process")
async def process_refund_request(
    request_id: str,
    request: Request,
    process_data: Dict[str, Any] = Body(...)
):
    """Process a refund request (approve/reject) - Admin only"""
    try:
        admin_uid = getattr(request.state, 'uid', None)
        if not admin_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_request = await get_refund_request_by_id(request_id)
        if not refund_request:
            raise HTTPException(status_code=404, detail="Refund request not found")
        
        action = process_data.get("action")  # "approve" or "reject"
        admin_notes = process_data.get("admin_notes", "")
        
        if action not in ["approve", "reject"]:
            raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
        
        # Update refund request status
        new_status = RefundRequestStatus.APPROVED if action == "approve" else RefundRequestStatus.REJECTED
        
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
            # Send approval email first
            try:
                details = await get_user_and_event_details(refund_request)
                if details["user_email"]:
                    await send_refund_approved_notification(
                        to_email=details["user_email"],
                        user_name=details["user_name"],
                        event_name=details["event_name"],
                        amount=refund_request.payment_amount,
                        request_id=refund_request.request_id,
                        admin_notes=admin_notes
                    )
                    logging.info(f"Refund approval email sent to {details['user_email']}")
            except Exception as e:
                logging.error(f"Failed to send approval email: {e}")
            
            try:
                paypal_result = await process_paypal_refund(
                    transaction_id=refund_request.transaction_id,
                    refund_amount=refund_request.payment_amount,
                    reason=f"Event refund - {refund_request.display_name}"
                )
                
                if paypal_result.get("success"):
                    # Update with PayPal refund details
                    await update_refund_request(request_id, RefundRequestUpdate(
                        status=RefundRequestStatus.COMPLETED,
                        paypal_refund_id=paypal_result.get("refund_id"),
                        paypal_refund_status=paypal_result.get("status")
                    ))
                    
                    # Send completion email
                    try:
                        details = await get_user_and_event_details(refund_request)
                        if details["user_email"]:
                            await send_refund_completed_notification(
                                to_email=details["user_email"],
                                user_name=details["user_name"],
                                event_name=details["event_name"],
                                amount=refund_request.payment_amount,
                                request_id=refund_request.request_id,
                                completion_method="PayPal"
                            )
                            logging.info(f"Refund completion email sent to {details['user_email']}")
                    except Exception as e:
                        logging.error(f"Failed to send completion email: {e}")
                    
                    # Update event attendee payment status to 'refunded'
                    try:
                        
                        event_doc = await DB.db["events"].find_one({"_id": ObjectId(refund_request.event_id)})
                        if event_doc:
                            attendees = event_doc.get("attendees", [])
                            modified = False
                            
                            for attendee in attendees:
                                # Match by user and person ID
                                if (attendee.get("user_uid") == refund_request.user_uid and
                                    str(attendee.get("person_id", "")) == str(refund_request.person_id or "")):
                                    attendee["payment_status"] = "refunded"
                                    modified = True
                                    break
                            
                            if modified:
                                await DB.db["events"].update_one(
                                    {"_id": ObjectId(refund_request.event_id)},
                                    {"$set": {"attendees": attendees}}
                                )
                                logging.info(f"Updated attendee payment status to 'refunded' for refund {request_id}")
                    except Exception as e:
                        logging.error(f"Failed to update attendee status after refund: {e}")
                        
                else:
                    # PayPal refund failed, update status
                    error_msg = paypal_result.get('error', 'Unknown error')
                    await update_refund_request(request_id, RefundRequestUpdate(
                        status=RefundRequestStatus.PENDING,
                        admin_notes=add_system_log(admin_notes, f"PayPal refund failed: {error_msg}")
                    ))
                    
            except Exception as e:
                logging.error(f"PayPal refund failed for request {request_id}: {e}")
                await update_refund_request(request_id, RefundRequestUpdate(
                    admin_notes=add_system_log(admin_notes, f"PayPal refund failed: {str(e)}")
                ))
        else:
            # Refund was rejected - send rejection email
            try:
                details = await get_user_and_event_details(refund_request)
                if details["user_email"]:
                    await send_refund_rejected_notification(
                        to_email=details["user_email"],
                        user_name=details["user_name"],
                        event_name=details["event_name"],
                        amount=refund_request.payment_amount,
                        request_id=refund_request.request_id,
                        reason=admin_notes or "Your refund request has been reviewed and cannot be approved at this time."
                    )
                    logging.info(f"Refund rejection email sent to {details['user_email']}")
            except Exception as e:
                logging.error(f"Failed to send rejection email: {e}")
        
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

@admin_refund_router.post("/refund/request/{request_id}/manual-complete")
async def manually_complete_refund(
    request_id: str,
    request: Request,
    completion_data: Dict[str, Any] = Body(...)
):
    """Manually mark a refund as completed (when PayPal processing failed) - Admin only"""
    try:
        admin_uid = getattr(request.state, 'uid', None)
        if not admin_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_request = await get_refund_request_by_id(request_id)
        if not refund_request:
            raise HTTPException(status_code=404, detail="Refund request not found")
        
        # Only allow manual completion for approved/pending requests
        if refund_request.status not in [RefundRequestStatus.APPROVED, RefundRequestStatus.PENDING]:
            raise HTTPException(status_code=400, detail="Refund request cannot be manually completed")
        
        manual_notes = completion_data.get("manual_notes", "")
        refund_method = completion_data.get("refund_method", "manual")  # "manual", "bank_transfer", etc.
        proof_image_id = completion_data.get("proof_image_id", None)  # Optional asset ID for proof photo
        
        # Create clear manual completion notes
        manual_completion_note = f"MANUAL COMPLETION by Admin\n"
        manual_completion_note += f"Method: {refund_method}\n"
        if manual_notes:
            manual_completion_note += f"Admin Notes: {manual_notes}\n"
        manual_completion_note += f"Completed by: {admin_uid}\n"
        manual_completion_note += f"Completed at: {datetime.utcnow().isoformat()}Z"
        
        # Handle previous system notes more elegantly
        previous_notes = refund_request.admin_notes or ""
        if previous_notes.strip():
            # Count previous retry attempts for summary
            retry_count = previous_notes.count("PayPal refund retry failed")
            paypal_failed = "PayPal refund failed" in previous_notes
            
            summary_note = ""
            if paypal_failed or retry_count > 0:
                summary_note = f"\n\n--- System Processing Summary ---\n"
                if paypal_failed:
                    summary_note += f"• PayPal automatic processing failed\n"
                if retry_count > 0:
                    summary_note += f"• PayPal retry attempts: {retry_count}\n"
                summary_note += f"• Reason for manual completion: PayPal processing unsuccessful\n"
                summary_note += f"• Full system logs available on request"
            
            final_admin_notes = f"{manual_completion_note}{summary_note}"
        else:
            final_admin_notes = manual_completion_note
        
        # Update refund request to completed
        updates = RefundRequestUpdate(
            status=RefundRequestStatus.COMPLETED,
            admin_notes=final_admin_notes,
            processed_by=admin_uid,
            manual_refund_method=refund_method,
            manual_refund_proof_image_id=proof_image_id
        )
        
        success = await update_refund_request(request_id, updates)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update refund request")
        
        # Send completion email
        try:
            details = await get_user_and_event_details(refund_request)
            if details["user_email"]:
                await send_refund_completed_notification(
                    to_email=details["user_email"],
                    user_name=details["user_name"],
                    event_name=details["event_name"],
                    amount=refund_request.payment_amount,
                    request_id=refund_request.request_id,
                    completion_method=refund_method.title()
                )
                logging.info(f"Manual refund completion email sent to {details['user_email']}")
        except Exception as e:
            logging.error(f"Failed to send manual completion email: {e}")
        
        # Update event attendee payment status to 'refunded'
        try:
            
            event_doc = await DB.db["events"].find_one({"_id": ObjectId(refund_request.event_id)})
            if event_doc:
                attendees = event_doc.get("attendees", [])
                modified = False
                
                for attendee in attendees:
                    # Match by user and person ID
                    if (attendee.get("user_uid") == refund_request.user_uid and
                        str(attendee.get("person_id", "")) == str(refund_request.person_id or "")):
                        attendee["payment_status"] = "refunded"
                        modified = True
                        break
                
                if modified:
                    await DB.db["events"].update_one(
                        {"_id": ObjectId(refund_request.event_id)},
                        {"$set": {"attendees": attendees}}
                    )
                    logging.info(f"Updated attendee payment status to 'refunded' for manual completion of refund {request_id}")
        except Exception as e:
            logging.error(f"Failed to update attendee status after manual refund completion: {e}")
        
        return {
            "success": True,
            "message": "Refund manually completed successfully",
            "refund_method": refund_method
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error manually completing refund request {request_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to manually complete refund request")

@admin_refund_router.post("/refund/request/{request_id}/retry-paypal")
async def retry_paypal_refund(
    request_id: str,
    request: Request
):
    """Retry PayPal refund processing for a failed refund - Admin only"""
    try:
        admin_uid = getattr(request.state, 'uid', None)
        if not admin_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_request = await get_refund_request_by_id(request_id)
        if not refund_request:
            raise HTTPException(status_code=404, detail="Refund request not found")
        
        # Only allow retry for pending requests
        if refund_request.status != RefundRequestStatus.PENDING:
            raise HTTPException(status_code=400, detail="Can only retry PayPal processing for pending requests")
        
        # Retry PayPal refund
        try:
            paypal_result = await process_paypal_refund(
                transaction_id=refund_request.transaction_id,
                refund_amount=refund_request.payment_amount,
                reason=f"Event refund retry - {refund_request.display_name}"
            )
            
            if paypal_result.get("success"):
                # Update with PayPal refund details
                await update_refund_request(request_id, RefundRequestUpdate(
                    status=RefundRequestStatus.COMPLETED,
                    paypal_refund_id=paypal_result.get("refund_id"),
                    paypal_refund_status=paypal_result.get("status"),
                    admin_notes=add_system_log(refund_request.admin_notes, "PayPal refund retry successful")
                ))
                
                # Send completion email
                try:
                    details = await get_user_and_event_details(refund_request)
                    if details["user_email"]:
                        await send_refund_completed_notification(
                            to_email=details["user_email"],
                            user_name=details["user_name"],
                            event_name=details["event_name"],
                            amount=refund_request.payment_amount,
                            request_id=refund_request.request_id,
                            completion_method="PayPal"
                        )
                        logging.info(f"Retry completion email sent to {details['user_email']}")
                except Exception as e:
                    logging.error(f"Failed to send retry completion email: {e}")
                
                # Update event attendee payment status to 'refunded'
                try:
                    
                    event_doc = await DB.db["events"].find_one({"_id": ObjectId(refund_request.event_id)})
                    if event_doc:
                        attendees = event_doc.get("attendees", [])
                        modified = False
                        
                        for attendee in attendees:
                            # Match by user and person ID
                            if (attendee.get("user_uid") == refund_request.user_uid and
                                str(attendee.get("person_id", "")) == str(refund_request.person_id or "")):
                                attendee["payment_status"] = "refunded"
                                modified = True
                                break
                        
                        if modified:
                            await DB.db["events"].update_one(
                                {"_id": ObjectId(refund_request.event_id)},
                                {"$set": {"attendees": attendees}}
                            )
                            logging.info(f"Updated attendee payment status to 'refunded' for retry of refund {request_id}")
                except Exception as e:
                    logging.error(f"Failed to update attendee status after retry refund: {e}")
                
                return {
                    "success": True,
                    "message": "PayPal refund retry successful",
                    "paypal_refund_id": paypal_result.get("refund_id")
                }
            else:
                # Update with failure notes
                error_msg = paypal_result.get('error', 'Unknown error')
                await update_refund_request(request_id, RefundRequestUpdate(
                    admin_notes=add_system_log(refund_request.admin_notes, f"PayPal retry failed: {error_msg}")
                ))
                
                return {
                    "success": False,
                    "message": f"PayPal refund retry failed: {error_msg}"
                }
                
        except Exception as e:
            logging.error(f"PayPal refund retry failed for request {request_id}: {e}")
            await update_refund_request(request_id, RefundRequestUpdate(
                admin_notes=add_system_log(refund_request.admin_notes, f"PayPal retry exception: {str(e)}")
            ))
            
            return {
                "success": False,
                "message": f"PayPal refund retry failed: {str(e)}"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error retrying PayPal refund for request {request_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retry PayPal refund")

@admin_refund_router.get("/refund/request/{request_id}/transaction-info")
async def get_transaction_info(
    request_id: str,
    request: Request
):
    """Get diagnostic information about a transaction for troubleshooting - Admin only"""
    try:
        admin_uid = getattr(request.state, 'uid', None)
        if not admin_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        refund_request = await get_refund_request_by_id(request_id)
        if not refund_request:
            raise HTTPException(status_code=404, detail="Refund request not found")
        
        # Get transaction from database
        transaction = await DB.db["transactions"].find_one({"transaction_id": refund_request.transaction_id})
        
        # Try to get PayPal payment info
        paypal_info = {"status": "unknown", "error": None}
        try:
            
            access_token = get_paypal_access_token()
            if access_token:
                # Try as Payment ID first
                payment_url = f"{get_paypal_base_url()}/v1/payments/payment/{refund_request.transaction_id}"
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {access_token}',
                }
                
                response = requests.get(payment_url, headers=headers)
                if response.status_code == 200:
                    payment_data = response.json()
                    paypal_info = {
                        "status": "found_as_payment",
                        "state": payment_data.get("state"),
                        "intent": payment_data.get("intent"),
                        "create_time": payment_data.get("create_time"),
                        "transactions": len(payment_data.get("transactions", []))
                    }
                else:
                    # Try as Sale ID
                    sale_url = f"{get_paypal_base_url()}/v1/payments/sale/{refund_request.transaction_id}"
                    sale_response = requests.get(sale_url, headers=headers)
                    if sale_response.status_code == 200:
                        sale_data = sale_response.json()
                        paypal_info = {
                            "status": "found_as_sale",
                            "state": sale_data.get("state"),
                            "amount": sale_data.get("amount"),
                            "create_time": sale_data.get("create_time"),
                        }
                    else:
                        paypal_info = {
                            "status": "not_found",
                            "payment_check_status": response.status_code,
                            "sale_check_status": sale_response.status_code,
                            "error": f"Neither Payment nor Sale ID found. PayPal mode: {os.getenv('PAYPAL_MODE', 'unknown')}"
                        }
        except Exception as e:
            paypal_info = {"status": "error", "error": str(e)}
        
        return {
            "success": True,
            "refund_request": refund_request.model_dump(),
            "database_transaction": {k: v for k, v in (transaction or {}).items() if k != '_id'},
            "paypal_info": paypal_info,
            "environment": {
                "paypal_mode": os.getenv('PAYPAL_MODE', 'unknown'),
                "paypal_base_url": get_paypal_base_url() if 'get_paypal_base_url' in locals() else 'unknown'
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting transaction info for refund request {request_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get transaction info")

@admin_refund_router.get("/refund/requests/all")
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
        
        # Convert to RefundRequestOut with proof URLs
        refund_requests_out = []
        for refund_request in refund_requests:
            refund_out = await create_refund_out(refund_request)
            refund_requests_out.append(refund_out.model_dump())
        
        return {
            "success": True,
            "refund_requests": refund_requests_out,
            "total": len(refund_requests_out),
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logging.error(f"Error listing refund requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to list refund requests")

@admin_refund_router.post("/refund/migrate/populate-event-names")
async def populate_refund_event_names(request: Request):
    """Populate missing event names for existing refund requests - Admin only"""
    try:
        admin_uid = getattr(request.state, 'uid', None)
        if not admin_uid:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Run the migration
        updated_count = await populate_missing_event_names()
        
        return {
            "success": True,
            "message": f"Successfully populated event names for {updated_count} refund requests",
            "updated_count": updated_count
        }
        
    except Exception as e:
        logging.error(f"Error running event name migration: {e}")
        raise HTTPException(status_code=500, detail="Failed to populate event names")

# Partial Refund Support Endpoints
@admin_refund_router.get("/refund-options/{transaction_id}", summary="Get Refund Options")
async def get_refund_options(transaction_id: str, user_uid: str, request: Request):
    """Get available refund options for a transaction"""
    try:
        
        
        options = await calculate_refund_options(transaction_id, user_uid)
        
        if "error" in options:
            raise HTTPException(status_code=404, detail=options["error"])
        
        return {
            "success": True,
            "data": options
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting refund options: {e}")
        raise HTTPException(status_code=500, detail="Failed to get refund options")

@admin_refund_router.post("/validate-refund", summary="Validate Refund Amount")
async def validate_refund_amount_endpoint(
    request: Request,
    validation_data: Dict[str, Any] = Body(...)
):
    """Validate if a refund amount is allowed"""
    try:
        
        transaction_id = validation_data.get("transaction_id")
        user_uid = validation_data.get("user_uid")
        requested_amount = validation_data.get("requested_amount")
        refund_type = validation_data.get("refund_type", "per_person")
        
        if not all([transaction_id, user_uid, requested_amount]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        validation_result = await validate_refund_amount(transaction_id, user_uid, float(requested_amount), refund_type)
        
        if "error" in validation_result:
            return {
                "success": False,
                "error": validation_result["error"],
                "details": validation_result
            }
        
        return {
            "success": True,
            "valid": validation_result.get("valid", False),
            "data": validation_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error validating refund amount: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate refund amount")

@admin_refund_router.get("/refund-summary/{transaction_id}", summary="Get Refund Summary")
async def get_refund_summary_endpoint(transaction_id: str, request: Request):
    """Get a comprehensive summary of all refunds for a transaction"""
    try:
        
        
        summary = await get_refund_summary(transaction_id)
        
        if "error" in summary:
            raise HTTPException(status_code=404, detail=summary["error"])
        
        return {
            "success": True,
            "data": summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting refund summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get refund summary")

@admin_refund_router.post("/create-partial-refund", summary="Create Partial Refund Request")
async def create_partial_refund_request(
    request: Request,
    refund_data: RefundRequestCreate = Body(...)
):
    """Create a new refund request with support for partial amounts"""
    try:
        # Get admin user for validation (optional - could be user-initiated)
        admin_uid = getattr(request.state, "uid", None)
        
        # Validate refund type and amount if provided
        if refund_data.refund_type == "partial" and refund_data.requested_amount is not None:
            
            validation_result = await validate_refund_amount(
                "",  # Will be validated in create_refund_request
                admin_uid or "admin",
                refund_data.requested_amount,
                refund_data.refund_type
            )
            
            if "error" in validation_result:
                raise HTTPException(status_code=400, detail=validation_result["error"])
        
        # Create the refund request
        refund_request = await create_refund_request(refund_data, admin_uid or "admin")
        
        if not refund_request:
            raise HTTPException(status_code=400, detail="Failed to create refund request")
        
        # Convert to output format
        refund_out = await create_refund_out(refund_request)
        
        return {
            "success": True,
            "message": "Partial refund request created successfully",
            "refund_request": refund_out
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating partial refund request: {e}")
        raise HTTPException(status_code=500, detail="Failed to create partial refund request")