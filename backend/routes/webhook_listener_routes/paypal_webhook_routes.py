from fastapi import APIRouter, Request
from models.transaction import Transaction
from helpers.event_payment_helper import event_payment_helper
from mongo.database import DB
import logging
import json
from models.event import get_event_by_id

paypal_webhook_router = APIRouter(prefix="/paypal", tags=["paypal_webhook"])

@paypal_webhook_router.post("/webhook", status_code=200)
async def paypal_webhook(request: Request):
    """Handle PayPal webhook events for payments, refunds, and event registrations"""
    try:
        payload = await request.json()
        event_type = payload.get("event_type")
        resource = payload.get("resource", {})
        
        logging.info(f"🔔 PayPal Webhook received: {event_type}")
        logging.info(f"📄 Payload: {json.dumps(payload, indent=2)}")
        
        # Handle different event types
        if event_type == "PAYMENT.SALE.COMPLETED":
            # Payment completed - this is the main event for successful payments
            sale_id = resource.get("id")
            parent_payment = resource.get("parent_payment")
            amount = resource.get("amount", {}).get("total")
            currency = resource.get("amount", {}).get("currency", "USD")
            status = resource.get("state")
            create_time = resource.get("create_time")
            payer_info = resource.get("payer", {}).get("payer_info", {})
            user_email = payer_info.get("email")
            
            logging.info(f"💰 Payment completed - Sale ID: {sale_id}, Parent: {parent_payment}, Amount: ${amount}")
            
            # Check if this is an event registration payment
            # Look for existing transaction or payment session
            existing_transaction = await Transaction.get_transaction_by_id(parent_payment)
            
            if not existing_transaction:
                # Transaction doesn't exist - create it via webhook
                logging.info(f"🆕 Creating transaction from webhook for payment {parent_payment}")
                
                # Try to find payment session or bulk registration to get context
                payment_session = await DB.db["payment_sessions"].find_one({"payment_id": parent_payment})
                bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": parent_payment})
                
                transaction_data = {
                    "transaction_id": parent_payment,
                    "user_email": user_email or "",
                    "amount": float(amount) if amount else 0.0,
                    "status": "COMPLETED",
                    "type": "one-time",
                    "order_id": parent_payment,
                    "payment_method": "paypal",
                    "time": create_time,
                    "name": f"{payer_info.get('first_name', '')} {payer_info.get('last_name', '')}".strip() or "Anonymous",
                    "currency": currency,
                    "created_on": create_time,
                }
                
                # Determine if this is an event registration
                if payment_session or bulk_registration:
                    session = payment_session or bulk_registration
                    event_id = session.get("event_id")
                    user_uid = session.get("user_uid")
                    
                    if event_id:
                        # This is an event registration payment
                        event = await get_event_by_id(event_id)
                        
                        transaction_data.update({
                            "payment_type": "event_registration",
                            "event_id": event_id,
                            "event_name": event.name if event else "Unknown Event",
                            "user_uid": user_uid,
                            "fund_name": f"Event: {event.name if event else 'Unknown Event'}",
                            "event_type": "event_registration",
                            "metadata": {
                                "registration_count": session.get("registration_count", 1),
                                "event_fee_total": float(amount) if amount else 0.0,
                                "donation_total": 0.0,
                                "bulk_registration": session.get("registration_count", 1) > 1,
                                "webhook_created": True
                            }
                        })
                        
                        logging.info(f"🎫 Event registration webhook - Event: {event_id}, User: {user_uid}")
                        
                        # Update Event attendees' payment status after successful payment
                        try:
                            from models.event import update_attendee_payment_status
                            from bson import ObjectId
                            
                            # Get registrations from the session to update their payment status
                            registrations = session.get("registrations", [])
                            if registrations:
                                updated_count = 0
                                for registration in registrations:
                                    person_id = registration.get("person_id")
                                    
                                    # Generate attendee key - try both series and occurrence scopes
                                    person_object_id = ObjectId(person_id) if person_id else None
                                    person_id_str = str(person_object_id) if person_object_id else 'self'
                                    
                                    # Try series scope first (default registration scope)
                                    attendee_key_series = f"{user_uid}|{person_id_str}|rsvp|series"
                                    update_success = await update_attendee_payment_status(
                                        event_id=event_id,
                                        attendee_key=attendee_key_series,
                                        payment_status='completed',
                                        transaction_id=parent_payment
                                    )
                                    
                                    if not update_success:
                                        # Try occurrence scope as fallback
                                        attendee_key_occurrence = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                                        update_success = await update_attendee_payment_status(
                                            event_id=event_id,
                                            attendee_key=attendee_key_occurrence,
                                            payment_status='completed',
                                            transaction_id=parent_payment
                                        )
                                        logging.info(f"🔄 Webhook used occurrence scope for person {person_id}")
                                    else:
                                        logging.info(f"🔄 Webhook used series scope for person {person_id}")
                                    
                                    if update_success:
                                        updated_count += 1
                                        logging.info(f"🔄 Webhook updated attendee payment status for person {person_id}")
                                    else:
                                        logging.error(f"❌ Webhook failed to update attendee payment status for person {person_id} (tried both scopes)")
                                
                                logging.info(f"✅ Webhook updated {updated_count}/{len(registrations)} attendee payment statuses")
                            else:
                                logging.warning(f"⚠️ No registrations found in session for payment {parent_payment}")
                                
                        except Exception as payment_update_error:
                            logging.error(f"❌ Webhook error updating payment status: {payment_update_error}")
                            # Don't fail the webhook if payment status update fails
                            
                    elif session.get("form_slug"):
                        # Form payment
                        form_slug = session.get("form_slug")
                        form_response = session.get("form_response", {})
                        
                        transaction_data.update({
                            "payment_type": "form_submission",
                            "fund_name": f"Form: {form_slug}",
                            "form_slug": form_slug,
                            "note": "Form payment completed via webhook",
                            "metadata": {
                                "form_response_count": len(form_response),
                                "webhook_created": True
                            }
                        })
                        
                        logging.info(f"📝 Form payment webhook - Form: {form_slug}, User: {user_uid}")
                        
                        # NOTE: Form submissions are typically handled in complete_paypal_payment route
                        # This webhook creates the transaction record for tracking purposes
                        # No additional form processing needed here as it's handled by direct route
                            
                    else:
                        # Regular donation
                        transaction_data.update({
                            "payment_type": "donation",
                            "fund_name": "General",
                            "note": "Payment completed via webhook"
                        })
                else:
                    # No session found - treat as general donation
                    transaction_data.update({
                        "payment_type": "donation",
                        "fund_name": "General",
                        "note": "Payment completed via webhook (no session found)"
                    })
                
                # Create the transaction
                transaction = Transaction(**transaction_data)
                saved_transaction = await Transaction.create_transaction(transaction)
                
                if saved_transaction:
                    logging.info(f"✅ Webhook created transaction: {saved_transaction.transaction_id}")
                    return {
                        "success": True, 
                        "action": "transaction_created",
                        "transaction_id": parent_payment,
                        "sale_id": sale_id,
                        "amount": amount
                    }
                else:
                    logging.error(f"❌ Failed to create transaction from webhook")
                    return {"success": False, "message": "Failed to create transaction"}
            else:
                # Transaction already exists - just update status if needed
                if existing_transaction.status != "COMPLETED":
                    await Transaction.update_transaction_status(parent_payment, "COMPLETED")
                    logging.info(f"🔄 Webhook updated transaction {parent_payment} status to COMPLETED")
                    
                    # Also update Event attendees' payment status for existing transactions
                    try:
                        from models.event import update_attendee_payment_status
                        from bson import ObjectId
                        
                        # Check if this is an event registration by looking for session data
                        payment_session = await DB.db["payment_sessions"].find_one({"payment_id": parent_payment})
                        bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": parent_payment})
                        
                        if payment_session or bulk_registration:
                            session = payment_session or bulk_registration
                            event_id = session.get("event_id")
                            user_uid = session.get("user_uid")
                            registrations = session.get("registrations", [])
                            form_slug = session.get("form_slug")
                            
                            if event_id and user_uid and registrations:
                                # Handle event registration payment status updates
                                updated_count = 0
                                for registration in registrations:
                                    person_id = registration.get("person_id")
                                    
                                    # Generate attendee key - try both series and occurrence scopes
                                    person_object_id = ObjectId(person_id) if person_id else None
                                    person_id_str = str(person_object_id) if person_object_id else 'self'
                                    
                                    # Try series scope first (default registration scope)
                                    attendee_key_series = f"{user_uid}|{person_id_str}|rsvp|series"
                                    update_success = await update_attendee_payment_status(
                                        event_id=event_id,
                                        attendee_key=attendee_key_series,
                                        payment_status='completed',
                                        transaction_id=parent_payment
                                    )
                                    
                                    if not update_success:
                                        # Try occurrence scope as fallback
                                        attendee_key_occurrence = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                                        update_success = await update_attendee_payment_status(
                                            event_id=event_id,
                                            attendee_key=attendee_key_occurrence,
                                            payment_status='completed',
                                            transaction_id=parent_payment
                                        )
                                        logging.info(f"🔄 Webhook used occurrence scope for existing person {person_id}")
                                    else:
                                        logging.info(f"🔄 Webhook used series scope for existing person {person_id}")
                                    
                                    if update_success:
                                        updated_count += 1
                                        logging.info(f"🔄 Webhook updated existing attendee payment status for person {person_id}")
                                    else:
                                        logging.error(f"❌ Webhook failed to update existing attendee payment status for person {person_id} (tried both scopes)")
                                
                                logging.info(f"✅ Webhook updated {updated_count}/{len(registrations)} existing attendee payment statuses")
                            elif form_slug:
                                # Handle form payment - no special processing needed, just log
                                logging.info(f"📝 Webhook confirmed form payment completion - Form: {form_slug}, User: {user_uid}")
                                
                    except Exception as payment_update_error:
                        logging.error(f"❌ Webhook error updating existing payment status: {payment_update_error}")
                        # Don't fail the webhook if payment status update fails
                        
                    return {
                        "success": True, 
                        "action": "status_updated",
                        "transaction_id": parent_payment,
                        "sale_id": sale_id
                    }
                else:
                    logging.info(f"✅ Transaction {parent_payment} already completed")
                    return {
                        "success": True, 
                        "action": "already_completed",
                        "transaction_id": parent_payment,
                        "sale_id": sale_id
                    }
        
        elif event_type == "PAYMENT.SALE.REFUNDED":
            # Handle refunds
            sale_id = resource.get("id")
            parent_payment = resource.get("parent_payment")
            
            await Transaction.update_transaction_status(parent_payment, "refunded")
            logging.info(f"🔄 Webhook updated transaction {parent_payment} status to refunded")
            
            return {
                "success": True, 
                "action": "refund_processed",
                "transaction_id": parent_payment,
                "sale_id": sale_id
            }
        
        elif event_type == "PAYMENT.SALE.DENIED":
            # Handle denied payments
            sale_id = resource.get("id")
            parent_payment = resource.get("parent_payment")
            
            await Transaction.update_transaction_status(parent_payment, "failed")
            logging.info(f"🔄 Webhook updated transaction {parent_payment} status to failed")
            
            return {
                "success": True, 
                "action": "payment_denied",
                "transaction_id": parent_payment,
                "sale_id": sale_id
            }
        
        else:
            logging.info(f"🤷 Unhandled webhook event type: {event_type}")
            return {"success": False, "message": f"Event type {event_type} not handled"}
            
    except Exception as e:
        logging.error(f"❌ Webhook error: {str(e)}")
        return {"success": False, "message": f"Webhook processing error: {str(e)}"}
