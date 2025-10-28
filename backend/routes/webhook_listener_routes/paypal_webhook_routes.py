from fastapi import APIRouter, Request, HTTPException
from models.transaction import Transaction, PaymentStatus
from models.paypal_webhook_schemas import validate_webhook_payload, extract_payment_info
from helpers.event_payment_helper import event_payment_helper
from mongo.database import DB
import logging
import json
from models.event import get_event_by_id
from models.event import update_attendee_payment_status
from bson import ObjectId

paypal_webhook_router = APIRouter(prefix="/paypal", tags=["paypal_webhook"])

@paypal_webhook_router.post("/webhook", status_code=200)
async def paypal_webhook(request: Request):
    """
    Handle PayPal webhook events for external/unexpected payment events only.
    
    Normal payment flow (user-initiated) is handled synchronously in the success callback.
    Webhooks are reserved for:
    - PAYMENT.SALE.REFUNDED (refunds from PayPal website)
    - PAYMENT.SALE.DENIED (failed payments)
    - BILLING.SUBSCRIPTION.CANCELLED (subscription cancellations from PayPal)
    - Disputes, chargebacks, and other external events
    """
    try:
        payload = await request.json()
        
        logging.info(f"🔔 PayPal Webhook received: {payload.get('event_type')}")
        logging.info(f"📄 Raw Payload: {json.dumps(payload, indent=2)}")
        
        # Validate payload structure
        try:
            validated_payload = validate_webhook_payload(payload)
            payment_info = extract_payment_info(validated_payload)
            logging.info(f"✅ Webhook payload validated successfully")
            logging.info(f"💰 Payment info: {payment_info}")
        except Exception as validation_error:
            logging.error(f"❌ Invalid webhook payload: {validation_error}")
            # Don't fail completely, try to process with original payload for backward compatibility
            resource = payload.get("resource", {})
            payer_info = resource.get("payer", {}).get("payer_info", {})
            payment_info = {
                "event_type": payload.get("event_type"),
                "transaction_id": resource.get("parent_payment"),
                "sale_id": resource.get("id"),
                "amount": float(resource.get("amount", {}).get("total", 0)),
                "currency": resource.get("amount", {}).get("currency", "USD"),
                "state": resource.get("state"),
                "create_time": resource.get("create_time"),
                "payer_email": payer_info.get("email"),
                "payer_name": f"{payer_info.get('first_name', '')} {payer_info.get('last_name', '')}".strip() or "Anonymous"
            }
        
        event_type = payment_info["event_type"]
        parent_payment = payment_info["transaction_id"]
        sale_id = payment_info["sale_id"]
        amount = payment_info["amount"]
        currency = payment_info["currency"]
        create_time = payment_info["create_time"]
        user_email = payment_info["payer_email"]
        payer_name = payment_info["payer_name"]
        
        # Handle different event types
        if event_type == "PAYMENT.SALE.COMPLETED":
            logging.info(f"💰 Payment completed webhook - Sale ID: {sale_id}, Parent: {parent_payment}, Amount: ${amount}")
            
            # NOTE: Normal payment flow is handled synchronously in success callback
            # This webhook handles edge cases where transaction wasn't created properly
            existing_transaction = await Transaction.get_transaction_by_id(parent_payment)
            
            if not existing_transaction:
                logging.info(f"🆕 Creating missing transaction from webhook for payment {parent_payment}")
                # This is likely a delayed or missed transaction - create it from webhook
                
                # Try to find payment session or bulk registration to get context
                payment_session = await DB.db["payment_sessions"].find_one({"payment_id": parent_payment})
                bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": parent_payment})
                
                transaction_data = {
                    "transaction_id": parent_payment,
                    "user_email": user_email or "",
                    "amount": amount,
                    "status": PaymentStatus.COMPLETED,
                    "type": "one-time",
                    "order_id": parent_payment,
                    "payment_method": "paypal",
                    "time": create_time,
                    "name": payer_name,
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
                                "event_fee_total": amount,
                                "donation_total": 0.0,
                                "bulk_registration": session.get("registration_count", 1) > 1,
                                "webhook_created": True
                            }
                        })
                        
                        logging.info(f"🎫 Event registration webhook - Event: {event_id}, User: {user_uid}")
                        
                        # Update Event attendees' payment status after successful payment
                        try:
                        
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
                                        payment_status=PaymentStatus.COMPLETED,
                                        transaction_id=parent_payment
                                    )
                                    
                                    if not update_success:
                                        # Try occurrence scope as fallback
                                        attendee_key_occurrence = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                                        update_success = await update_attendee_payment_status(
                                            event_id=event_id,
                                            attendee_key=attendee_key_occurrence,
                                            payment_status=PaymentStatus.COMPLETED,
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
                if existing_transaction.status != PaymentStatus.COMPLETED:
                    await Transaction.update_transaction_status(parent_payment, PaymentStatus.COMPLETED)
                    logging.info(f"🔄 Webhook updated transaction {parent_payment} status to {PaymentStatus.COMPLETED}")
                    
                    # Also update Event attendees' payment status for existing transactions
                    try:
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
                                        payment_status=PaymentStatus.COMPLETED,
                                        transaction_id=parent_payment
                                    )
                                    
                                    if not update_success:
                                        # Try occurrence scope as fallback
                                        attendee_key_occurrence = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                                        update_success = await update_attendee_payment_status(
                                            event_id=event_id,
                                            attendee_key=attendee_key_occurrence,
                                            payment_status=PaymentStatus.COMPLETED,
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
            # Handle refunds - mirror the COMPLETED branch logic for attendee status updates
            await Transaction.update_transaction_status(parent_payment, PaymentStatus.REFUNDED)
            logging.info(f"🔄 Webhook updated transaction {parent_payment} status to {PaymentStatus.REFUNDED}")
            
            # Update Event attendees' payment status for refunded transactions
            try:
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
                        # Handle event registration payment status updates to REFUNDED
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
                                payment_status=PaymentStatus.REFUNDED,
                                transaction_id=parent_payment
                            )
                            
                            if not update_success:
                                # Try occurrence scope as fallback
                                attendee_key_occurrence = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                                update_success = await update_attendee_payment_status(
                                    event_id=event_id,
                                    attendee_key=attendee_key_occurrence,
                                    payment_status=PaymentStatus.REFUNDED,
                                    transaction_id=parent_payment
                                )
                                logging.info(f"🔄 Refund webhook used occurrence scope for person {person_id}")
                            else:
                                logging.info(f"🔄 Refund webhook used series scope for person {person_id}")
                            
                            if update_success:
                                updated_count += 1
                                logging.info(f"💸 Refund webhook updated attendee payment status to REFUNDED for person {person_id}")
                            else:
                                logging.error(f"❌ Refund webhook failed to update attendee payment status for person {person_id} (tried both scopes)")
                        
                        logging.info(f"✅ Refund webhook updated {updated_count}/{len(registrations)} attendee payment statuses to REFUNDED")
                        
                        # TODO: Add additional refund side effects here as needed:
                        # - Release event seats/capacity if applicable
                        # - Send refund notification emails
                        # - Update attendee status (e.g., remove from event, mark as refunded)
                        # - Record refund metadata for audit trails
                        
                    elif form_slug:
                        # Handle form payment refund - log the refund
                        logging.info(f"💸 Refund webhook processed form payment refund - Form: {form_slug}, User: {user_uid}")
                        # TODO: Add form-specific refund processing if needed
                        
                else:
                    # No session found - general payment refund
                    logging.info(f"💸 Refund webhook processed general payment refund - no session data found")
                    
            except Exception as payment_update_error:
                logging.error(f"❌ Refund webhook error updating payment status: {payment_update_error}")
                # Don't fail the webhook if payment status update fails
            
            return {
                "success": True, 
                "action": "refund_processed",
                "transaction_id": parent_payment,
                "sale_id": sale_id,
                "amount": amount
            }
        
        elif event_type == "PAYMENT.SALE.DENIED":
            # Handle denied payments
            await Transaction.update_transaction_status(parent_payment, PaymentStatus.FAILED)
            logging.info(f"🔄 Webhook updated transaction {parent_payment} status to {PaymentStatus.FAILED}")
            
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