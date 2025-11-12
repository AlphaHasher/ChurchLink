'''
from fastapi import APIRouter, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from models.transaction import Transaction, PaymentStatus, RefundStatus
from models.paypal_webhook_schemas import validate_webhook_payload, extract_payment_info
from helpers.event_payment_helper import event_payment_helper
from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url
from mongo.database import DB
import logging
import json
from datetime import datetime, timedelta

import os
from models.event import get_event_by_id
from models.event import update_attendee_payment_status
from bson import ObjectId
import httpx

paypal_webhook_router = APIRouter(prefix="/paypal", tags=["paypal_webhook"])

async def check_and_record_transmission_id(transmission_id: str) -> bool:
    """
    Check if transmission ID has been processed before and record it to prevent replay attacks.
    
    Args:
        transmission_id: PayPal transmission ID from webhook headers
        
    Returns:
        True if this is a new transmission ID, False if already processed
    """
    try:
        # Use a dedicated collection for webhook replay protection
        webhook_replay_collection = DB.db["webhook_replay_protection"]
        
        # Check if transmission ID already exists
        existing = await webhook_replay_collection.find_one({"transmission_id": transmission_id})
        
        if existing:
            logging.warning(f"🔄 Replay attack detected - transmission ID {transmission_id[:10]}... already processed")
            return False
        
        # Record this transmission ID with expiration (1 hour from now)
        expiry_time = datetime.utcnow() + timedelta(hours=1)
        await webhook_replay_collection.insert_one({
            "transmission_id": transmission_id,
            "processed_at": datetime.utcnow(),
            "expires_at": expiry_time
        })
        
        # Create TTL index if it doesn't exist (will be created once and ignored thereafter)
        try:
            await webhook_replay_collection.create_index("expires_at", expireAfterSeconds=0)
        except Exception:
            pass  # Index might already exist
        
        logging.info(f"✅ New transmission ID recorded: {transmission_id[:10]}...")
        return True
        
    except Exception as e:
        logging.error(f"❌ Error checking transmission ID replay protection: {e}")
        # In case of error, allow processing to prevent false positives
        # but log the issue for investigation
        return True

async def verify_paypal_webhook_signature(headers: dict, body: bytes) -> bool:
    """
    Verify PayPal webhook signature using PayPal's webhook verification API.
    
    Args:
        headers: Request headers (must use lowercase keys)
        body: Raw request body bytes
        
    Returns:
        True if signature is valid, False otherwise
    """
    try:
        # Extract signature-related headers (case-insensitive, use lowercase)
        transmission_id = headers.get("paypal-transmission-id")
        cert_url = headers.get("paypal-cert-url")
        transmission_sig = headers.get("paypal-transmission-sig")
        transmission_time = headers.get("paypal-transmission-time")
        auth_algo = headers.get("paypal-auth-algo", "SHA256withRSA")
        
        if not all([transmission_id, cert_url, transmission_sig, transmission_time]):
            logging.error("❌ Missing required PayPal webhook signature headers")
            return False
        
        # Check for replay attacks using transmission ID
        is_new_transmission = await check_and_record_transmission_id(transmission_id)
        if not is_new_transmission:
            logging.error(f"❌ PayPal webhook replay attack detected - transmission ID: {transmission_id[:10]}...")
            return False
        
        # Get webhook ID from environment or database settings
        webhook_id = os.getenv("PAYPAL_WEBHOOK_ID")
        if not webhook_id:
            try:
                # Try to get from database settings
                paypal_settings = await DB.get_paypal_settings() if hasattr(DB, 'get_paypal_settings') else {}
                webhook_id = paypal_settings.get("PAYPAL_WEBHOOK_ID") if paypal_settings else None
            except Exception:
                pass
        
        if not webhook_id:
            logging.error("❌ Missing PayPal webhook ID configuration")
            return False
        
        # Get PayPal access token (wrapped to prevent blocking the event loop)
        access_token = await run_in_threadpool(get_paypal_access_token)
        if not access_token:
            logging.error("❌ Failed to get PayPal access token for webhook verification")
            return False
        
        # Prepare verification payload
        verify_payload = {
            "transmission_id": transmission_id,
            "transmission_time": transmission_time,
            "cert_url": cert_url,
            "auth_algo": auth_algo,
            "transmission_sig": transmission_sig,
            "webhook_id": webhook_id,
            "webhook_event": json.loads(body.decode("utf-8")),
        }
        
        # Call PayPal's webhook verification API
        verification_url = f"{get_paypal_base_url()}/v1/notifications/verify-webhook-signature"
        
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
            response = await client.post(
                verification_url,
                json=verify_payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
            )
        
        if response.status_code != 200:
            logging.error(f"❌ PayPal webhook verification API error: {response.status_code}")
            return False
        
        verification_result = response.json()
        verification_status = verification_result.get("verification_status")
        
        if verification_status == "SUCCESS":
            logging.info(f"✅ PayPal webhook signature verified successfully - ID: {transmission_id[:10]}...")
            return True
        else:
            logging.error(f"❌ PayPal webhook signature verification failed: {verification_status}")
            return False
        
    except Exception as e:
        logging.error(f"❌ Error verifying PayPal webhook signature: {e}")
        return False

def create_redacted_webhook_summary(payload: dict) -> dict:
    """
    Create a sanitized summary of webhook payload for logging without PII.
    
    Args:
        payload: Full webhook payload
        
    Returns:
        Dict with redacted summary safe for logging
    """
    try:
        resource = payload.get("resource", {})
        
        # Extract basic event information
        summary = {
            "event_type": payload.get("event_type"),
            "resource_type": payload.get("resource_type") or resource.get("type"),
            "create_time": payload.get("create_time") or resource.get("create_time"),
        }
        
        # Extract IDs (safe to log)
        if "id" in resource:
            summary["resource_id"] = resource["id"]
        if "parent_payment" in resource:
            summary["parent_payment"] = resource["parent_payment"]
        if "invoice_id" in resource:
            summary["invoice_id"] = resource["invoice_id"]
        if "order_id" in resource:
            summary["order_id"] = resource["order_id"]
            
        # Handle supplementary data for order IDs
        supp_data = resource.get("supplementary_data", {})
        related_ids = supp_data.get("related_ids", {})
        if "order_id" in related_ids:
            summary["order_id"] = related_ids["order_id"]
            
        # Redact email addresses (show domain and first/last char)
        def redact_email(email):
            if not email or "@" not in email:
                return email
            local, domain = email.split("@", 1)
            if len(local) <= 2:
                return f"**@{domain}"
            return f"{local[0]}***{local[-1]}@{domain}"
        
        # Handle payer information with redaction
        payer = resource.get("payer", {})
        if payer:
            payer_info = payer.get("payer_info", {})
            if "email" in payer_info:
                summary["payer_email_redacted"] = redact_email(payer_info["email"])
            if "payer_id" in payer_info:
                payer_id = payer_info["payer_id"]
                summary["payer_id_suffix"] = payer_id[-4:] if len(payer_id) > 4 else "****"
                
        # Handle subscriber information (for subscriptions)
        subscriber = resource.get("subscriber", {})
        if subscriber and "email_address" in subscriber:
            summary["subscriber_email_redacted"] = redact_email(subscriber["email_address"])
            
        # Add amount information (safe to log)
        if "amount" in resource:
            amount_info = resource["amount"]
            summary["amount"] = {
                "total": amount_info.get("total"),
                "currency": amount_info.get("currency")
            }
            
        # Add state/status (safe to log)
        if "state" in resource:
            summary["state"] = resource["state"]
        if "status" in resource:
            summary["status"] = resource["status"]
            
        return summary
        
    except Exception as e:
        logging.error(f"❌ Error creating redacted webhook summary: {e}")
        return {"event_type": payload.get("event_type"), "error": "redaction_failed"}

@paypal_webhook_router.post("/webhook", status_code=200)
async def paypal_webhook(request: Request):
    """
    Handle PayPal webhook events for external/unexpected payment events only.
    
    Normal payment flow (user-initiated) is handled synchronously in the success callback.
    Webhooks are reserved for:
    - PAYMENT.SALE.COMPLETED / PAYMENT.CAPTURE.COMPLETED (delayed/missed transactions)
    - PAYMENT.SALE.REFUNDED / PAYMENT.CAPTURE.REFUNDED (refunds from PayPal website)
    - PAYMENT.SALE.DENIED / PAYMENT.CAPTURE.DECLINED (failed payments)
    - BILLING.SUBSCRIPTION.CANCELLED (subscription cancellations from PayPal)
    - Disputes, chargebacks, and other external events
    """
    try:
        # Read raw body first for signature verification
        body = await request.body()
        
        # Get headers using lowercase names (FastAPI/Starlette normalizes to lowercase)
        headers = {
            "paypal-transmission-id": request.headers.get("paypal-transmission-id"),
            "paypal-cert-url": request.headers.get("paypal-cert-url"),
            "paypal-transmission-sig": request.headers.get("paypal-transmission-sig"),
            "paypal-transmission-time": request.headers.get("paypal-transmission-time"),
            "paypal-auth-algo": request.headers.get("paypal-auth-algo")
        }
        
        # Verify webhook signature for security
        is_valid_signature = await verify_paypal_webhook_signature(headers, body)
        if not is_valid_signature:
            logging.error("❌ PayPal webhook signature verification failed")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        # Parse JSON payload after verification
        try:
            payload = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            logging.error(f"❌ Invalid JSON in PayPal webhook: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
        logging.info(f"🔔 PayPal Webhook received: {payload.get('event_type')}")
        
        # Log redacted summary instead of full payload to protect PII
        redacted_summary = create_redacted_webhook_summary(payload)
        logging.info(f"📄 Webhook summary (PII redacted): {json.dumps(redacted_summary, indent=2)}")
        
        # Validate payload structure
        try:
            validated_payload = validate_webhook_payload(payload)
            payment_info = extract_payment_info(validated_payload)
            logging.info(f"✅ Webhook payload validated successfully")
            
            # Log payment info with PII redaction
            payment_info_redacted = payment_info.copy()
            if "payer_email" in payment_info_redacted:
                email = payment_info_redacted["payer_email"]
                if email and "@" in email:
                    local, domain = email.split("@", 1)
                    if len(local) <= 2:
                        payment_info_redacted["payer_email"] = f"**@{domain}"
                    else:
                        payment_info_redacted["payer_email"] = f"{local[0]}***{local[-1]}@{domain}"
            if "payer_name" in payment_info_redacted:
                # Keep payer name but could be redacted further if needed
                pass
            logging.info(f"💰 Payment info (emails redacted): {payment_info_redacted}")
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
        if event_type in ("PAYMENT.SALE.COMPLETED", "PAYMENT.CAPTURE.COMPLETED"):
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
        
        elif event_type in ("PAYMENT.SALE.REFUNDED", "PAYMENT.CAPTURE.REFUNDED"):
            # Handle refunds - check for idempotency first
            existing_transaction = await Transaction.get_transaction_by_id(parent_payment)
            
            if not existing_transaction:
                logging.warning(f"⚠️ Refund webhook received for non-existent transaction {parent_payment}")
                return {"success": False, "message": "Transaction not found for refund"}
            
            # Idempotency guard: only process if not already refunded
            if existing_transaction.status in [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED]:
                logging.info(f"✅ Transaction {parent_payment} already refunded - skipping duplicate refund webhook")
                return {
                    "success": True, 
                    "action": "already_refunded",
                    "transaction_id": parent_payment,
                    "sale_id": sale_id
                }
            
            # Determine partial vs full refund by comparing amounts
            from decimal import Decimal, InvalidOperation
            try:
                refunded_amount = Decimal(str(amount or 0))
                original_amount = Decimal(str(existing_transaction.amount)) if existing_transaction.amount else Decimal('0')
            except (InvalidOperation, ValueError, TypeError) as e:
                logging.error(f"❌ Invalid amount in refund webhook for {parent_payment}: refund={amount}, original={existing_transaction.amount}, error={e}")
                # Default to treating as full refund if we can't parse amounts
                refunded_amount = Decimal('0')
                original_amount = Decimal('0')
            
            # Check for currency mismatch
            transaction_currency = getattr(existing_transaction, 'currency', 'USD')
            webhook_currency = currency or 'USD'
            if transaction_currency != webhook_currency:
                logging.warning(f"Currency mismatch for transaction {parent_payment}: transaction={transaction_currency}, webhook={webhook_currency}")
            
            # Determine if this is a partial refund (allowing for small rounding differences)
            # If we can't determine amounts, default to full refund (safer assumption)
            is_partial = False
            if original_amount > 0 and refunded_amount > 0:
                is_partial = refunded_amount < (original_amount - Decimal('0.01'))
            elif original_amount <= 0:
                logging.warning(f"⚠️ Original transaction amount is zero or invalid for {parent_payment}, assuming full refund")
            
            # Update transaction status based on refund type
            new_status = PaymentStatus.PARTIALLY_REFUNDED if is_partial else PaymentStatus.REFUNDED
            await Transaction.update_transaction_status(parent_payment, new_status)
            logging.info(
                f"🔄 Webhook updated transaction {parent_payment} status to {new_status} "
                f"(refunded=${refunded_amount} of ${original_amount})"
            )
            
            # Update transaction with refund information
            refund_type = "partial" if is_partial else "full"
            await Transaction.update_transaction_refund_info(
                parent_payment, 
                refund_type, 
                refunded_on=create_time or None,
                refunded_amount=refunded_amount if refunded_amount > 0 else None
            )
            logging.info(f"🔄 Webhook updated transaction {parent_payment} refund info: type={refund_type}")
            
            # Update Event attendees' payment status for refunded transactions
            # For partial refunds, we don't automatically change attendee status
            # since they may still have an active registration
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
                        # Only update attendee status for full refunds
                        # For partial refunds, transaction metadata is updated but attendees remain active
                        if not is_partial:
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
                            
                            logging.info(f"✅ Full refund webhook updated {updated_count}/{len(registrations)} attendee payment statuses to REFUNDED")
                        else:
                            logging.info(f"📝 Partial refund webhook for transaction {parent_payment} - attendee statuses remain unchanged (${refunded_amount} of ${original_amount} refunded)")
                        
                        # TODO: Add additional refund side effects here as needed:
                        # - For full refunds: Release event seats/capacity if applicable
                        # - Send refund notification emails
                        # - For partial refunds: Record partial refund metadata for audit trails
                        # - Update attendee status (e.g., remove from event for full refund, mark as partially refunded)
                        
                    elif form_slug:
                        # Handle form payment refund - log the refund
                        logging.info(f"💸 Refund webhook processed {refund_type} form payment refund - Form: {form_slug}, User: {user_uid}")
                        # TODO: Add form-specific refund processing if needed
                        
                else:
                    # No session found - general payment refund
                    logging.info(f"💸 Refund webhook processed {refund_type} general payment refund - no session data found")
                    
            except Exception as payment_update_error:
                logging.error(f"❌ Refund webhook error updating payment status: {payment_update_error}")
                # Don't fail the webhook if payment status update fails
            
            # ✅ Also complete any matching refund requests
            try:
                # Use the webhook timestamp or current time as fallback
                completion_time = create_time or datetime.utcnow().isoformat()
                
                # Update refund request status with appropriate PayPal status
                paypal_refund_status = "completed" if not is_partial else "partial_completed"
                
                result = await DB.db["refund_requests"].update_many(
                    {
                        "transaction_id": parent_payment,
                        "status": {"$in": [RefundStatus.PROCESSING, RefundStatus.APPROVED, RefundStatus.PENDING]},
                    },
                    {
                        "$set": {
                            "status": RefundStatus.COMPLETED,
                            "paypal_refund_status": paypal_refund_status,
                            "refund_type": refund_type,
                            "updated_at": completion_time,
                            "processed_at": completion_time,
                        }
                    },
                )
                logging.info(f"✅ Completed {result.modified_count} refund request(s) for transaction {parent_payment} (type: {refund_type})")
            except Exception as e:
                logging.exception(f"Failed to complete refund_requests for {parent_payment}: {e}")
            
            return {
                "success": True, 
                "action": "refund_processed",
                "transaction_id": parent_payment,
                "sale_id": sale_id,
                "amount": amount
            }
        
        elif event_type in ("PAYMENT.SALE.DENIED", "PAYMENT.CAPTURE.DECLINED"):
            # Handle denied payments
            await Transaction.update_transaction_status(parent_payment, PaymentStatus.FAILED)
            logging.info(f"🔄 Webhook updated transaction {parent_payment} status to {PaymentStatus.FAILED}")
            
            return {
                "success": True, 
                "action": "payment_denied",
                "transaction_id": parent_payment,
                "sale_id": sale_id
            }
        
        elif event_type == "BILLING.SUBSCRIPTION.CANCELLED":
            # Handle subscription cancellation from PayPal
            subscription_id = payment_info.get("subscription_id") or payment_info.get("transaction_id")
            
            if subscription_id:
                # Update donation subscription status to cancelled
                try:
                    result = await DB.db["donations_subscriptions"].update_one(
                        {"subscription_id": subscription_id},
                        {
                            "$set": {
                                "status": "cancelled",
                                "cancelled_at": create_time,
                                "cancelled_reason": "cancelled_by_user_via_paypal"
                            }
                        }
                    )
                    
                    if result.modified_count > 0:
                        logging.info(f"🚫 Subscription {subscription_id} cancelled via PayPal webhook")
                        return {
                            "success": True, 
                            "action": "subscription_cancelled",
                            "subscription_id": subscription_id
                        }
                    else:
                        logging.warning(f"⚠️ Subscription {subscription_id} not found for cancellation")
                        return {
                            "success": True, 
                            "action": "subscription_not_found",
                            "subscription_id": subscription_id
                        }
                        
                except Exception as e:
                    logging.error(f"❌ Error cancelling subscription {subscription_id}: {e}")
                    return {"success": False, "message": f"Failed to cancel subscription: {str(e)}"}
            else:
                logging.warning("⚠️ BILLING.SUBSCRIPTION.CANCELLED webhook missing subscription ID")
                return {"success": False, "message": "Missing subscription ID in cancellation webhook"}
        
        else:
            logging.info(f"🤷 Unhandled webhook event type: {event_type}")
            return {"success": False, "message": f"Event type {event_type} not handled"}
            
    except Exception as e:
        logging.error(f"❌ Webhook error: {str(e)}")
        return {"success": False, "message": f"Webhook processing error: {str(e)}"}
'''