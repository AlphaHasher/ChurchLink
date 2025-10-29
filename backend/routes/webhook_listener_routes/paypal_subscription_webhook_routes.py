from fastapi import APIRouter, Request, HTTPException
from models.donation_subscription import DonationSubscription
from models.transaction import Transaction, PaymentStatus  
import logging
import json
from models.event import get_event_by_id
from mongo.database import DB
from bson.objectid import ObjectId

paypal_subscription_webhook_router = APIRouter(prefix="/paypal/subscription", tags=["paypal_subscription_webhook"])

async def verify_paypal_webhook_signature(headers: dict, body: bytes) -> bool:
    """
    Verify PayPal webhook signature using PayPal's certificate and signature validation.
    
    Args:
        headers: Request headers (must use lowercase keys)
        body: Raw request body bytes
        
    Returns:
        True if signature is valid, False otherwise
    """
    try:
        # Extract signature-related headers (case-insensitive, use lowercase)
        transmission_id = headers.get("paypal-transmission-id")
        cert_id = headers.get("paypal-cert-id") 
        transmission_sig = headers.get("paypal-transmission-sig")
        transmission_time = headers.get("paypal-transmission-time")
        auth_algo = headers.get("paypal-auth-algo", "SHA256withRSA")
        
        if not all([transmission_id, cert_id, transmission_sig, transmission_time]):
            logging.error("❌ Missing required PayPal webhook signature headers")
            return False
            
        # For now, implement basic webhook ID verification
        # In production, you should implement full certificate verification
        # using PayPal's webhook verification API or certificate validation
        
        # TODO: Implement full PayPal webhook signature verification
        # This is a critical security feature that should verify:
        # 1. Certificate authenticity from PayPal
        # 2. Signature validation using the certificate
        # 3. Transmission ID uniqueness to prevent replay attacks
        
        logging.info(f"🔐 PayPal subscription webhook signature validation - ID: {transmission_id[:10]}...")
        
        # For now, return True but log that verification is needed
        logging.warning("⚠️ PayPal subscription webhook signature verification not fully implemented - this is a security risk")
        return True
        
    except Exception as e:
        logging.error(f"❌ Error verifying PayPal subscription webhook signature: {e}")
        return False

@paypal_subscription_webhook_router.post("/webhook", status_code=200)
async def paypal_subscription_webhook(request: Request):
    try:
        # Read raw body first for signature verification
        body = await request.body()
        
        # Get headers using lowercase names (FastAPI/Starlette normalizes to lowercase)
        headers = {
            "paypal-transmission-id": request.headers.get("paypal-transmission-id"),
            "paypal-cert-id": request.headers.get("paypal-cert-id"),
            "paypal-transmission-sig": request.headers.get("paypal-transmission-sig"),
            "paypal-transmission-time": request.headers.get("paypal-transmission-time"),
            "paypal-auth-algo": request.headers.get("paypal-auth-algo")
        }
        
        # Verify webhook signature for security
        is_valid_signature = await verify_paypal_webhook_signature(headers, body)
        if not is_valid_signature:
            logging.error("❌ PayPal subscription webhook signature verification failed")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        # Parse JSON payload after verification
        try:
            payload = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            logging.error(f"❌ Invalid JSON in PayPal subscription webhook: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
            
        event_type = payload.get("event_type")
        resource = payload.get("resource", {})
        subscription_id = resource.get("id") or resource.get("billing_agreement_id") or resource.get("plan_id")
        transaction_id = None
        if "sale" in resource:
            transaction_id = resource["sale"].get("id")
        elif "transactions" in resource:
            for txn in resource["transactions"]:
                if "related_resources" in txn:
                    for res in txn["related_resources"]:
                        if "sale" in res and "id" in res["sale"]:
                            transaction_id = res["sale"]["id"]

        # Always log event type and payload for audit
        if subscription_id:
            update_fields = {
                "last_webhook_event": event_type,
                "last_webhook_payload": payload,
            }
            if transaction_id:
                update_fields["last_webhook_transaction_id"] = transaction_id
            for field, value in update_fields.items():
                await DonationSubscription.update_donation_subscription_field(subscription_id, field, value)

        # Event-specific logic
        if event_type == "BILLING.SUBSCRIPTION.ACTIVATED":
            payer_info = resource.get("subscriber", {}).get("name", {})
            payer_name = f"{payer_info.get('given_name', '')} {payer_info.get('surname', '')}".strip()
            payer_email = resource.get("subscriber", {}).get("email_address", "")
            
            # Query by subscription_id directly instead of empty email
            subscription = await DonationSubscription.get_donation_subscription_by_id(subscription_id)
            if subscription:
                await DonationSubscription.update_donation_subscription_field(subscription_id, "user_email", payer_email)
                await DonationSubscription.update_donation_subscription_field(subscription_id, "name", payer_name)
                return {"success": True, "subscription_id": subscription.id, "donor_name": payer_name}
            
            # Fallback: try to match by user_email and status (pending) and update subscription_id
            subscriptions = await DonationSubscription.get_donation_subscriptions_by_email(payer_email)
            for sub in subscriptions:
                if not sub.subscription_id and sub.status == "pending":
                    # Update using MongoDB _id since subscription_id is not set yet
                    sub_object_id = ObjectId(sub.id)
                    await DB.update_document("donations_subscriptions", {"_id": sub_object_id}, {"subscription_id": subscription_id})
                    await DB.update_document("donations_subscriptions", {"_id": sub_object_id}, {"user_email": payer_email})
                    await DB.update_document("donations_subscriptions", {"_id": sub_object_id}, {"name": payer_name})
                    return {"success": True, "subscription_id": sub.id, "donor_name": payer_name}
            return {"success": False, "message": "Subscription not found for subscription_id"}
        elif event_type == "BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED":
            next_billing_time = resource.get("next_billing_time")
            sub = await DonationSubscription.get_donation_subscription_by_id(subscription_id)
            if sub:
                await DonationSubscription.update_donation_subscription_field(subscription_id, "next_billing_time", next_billing_time)
                return {"success": True, "subscription_id": subscription_id, "next_billing_time": next_billing_time}
            return {"success": False, "message": "Subscription not found for subscription_id"}
        
        return {"success": True, "message": "Event logged for audit"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ PayPal subscription webhook error: {str(e)}")
        return {"success": False, "message": f"Webhook processing error: {str(e)}"}

@paypal_subscription_webhook_router.post("/money-webhook", status_code=200)
async def paypal_money_webhook(request: Request):
    """Handle PayPal money events for both subscriptions and one-time payments"""
    try:
        # Read raw body first for signature verification
        body = await request.body()
        
        # Get headers using lowercase names (FastAPI/Starlette normalizes to lowercase)
        headers = {
            "paypal-transmission-id": request.headers.get("paypal-transmission-id"),
            "paypal-cert-id": request.headers.get("paypal-cert-id"),
            "paypal-transmission-sig": request.headers.get("paypal-transmission-sig"),
            "paypal-transmission-time": request.headers.get("paypal-transmission-time"),
            "paypal-auth-algo": request.headers.get("paypal-auth-algo")
        }
        
        # Verify webhook signature for security
        is_valid_signature = await verify_paypal_webhook_signature(headers, body)
        if not is_valid_signature:
            logging.error("❌ PayPal money webhook signature verification failed")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        # Parse JSON payload after verification
        try:
            payload = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            logging.error(f"❌ Invalid JSON in PayPal money webhook: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
            
        event_type = payload.get("event_type")
        resource = payload.get("resource", {})
        logging.info(f"🔔 PayPal Money Webhook received: {event_type}")
        
        # Handle money events
        if event_type in ["PAYMENT.SALE.COMPLETED", "PAYMENT.SALE.REFUNDED", "PAYMENT.SALE.DENIED"]:
            # Extract details
            transaction_id = resource.get("id")
            parent_payment = resource.get("parent_payment")
            amount = resource.get("amount", {}).get("total")
            currency = resource.get("amount", {}).get("currency")
            status = resource.get("state")
            create_time = resource.get("create_time")
            update_time = resource.get("update_time")
            payer_info = resource.get("payer", {}).get("payer_info", {})
            user_email = payer_info.get("email")

            # Check if this is a subscription payment or one-time payment
            # Look for existing transaction first
            existing_transaction = await Transaction.get_transaction_by_id(parent_payment)
            
            if existing_transaction:
                # Transaction exists - delegate to main PayPal webhook for status updates
                # to prevent race conditions and ensure single source of truth
                logging.info(f"🔄 Transaction {parent_payment} exists - delegating to main webhook for status updates")
                return {"success": True, "action": "delegated_to_main_webhook", "order_id": parent_payment, "transaction_id": transaction_id}
            
            # Transaction doesn't exist - determine payment type and create
            
            # Check for event registration session
            payment_session = await DB.db["payment_sessions"].find_one({"payment_id": parent_payment})
            bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": parent_payment})
            
            # Normalize status to PaymentStatus constants (lowercase)
            status_map = {
                "completed": PaymentStatus.COMPLETED,
                "refunded": PaymentStatus.REFUNDED,
                "denied": PaymentStatus.FAILED,
                "failed": PaymentStatus.FAILED,
                "canceled": PaymentStatus.CANCELLED,
                "cancelled": PaymentStatus.CANCELLED,
                "pending": PaymentStatus.PENDING,
            }
            normalized_status = status_map.get((status or "").lower(), (status or "pending").lower())
            
            # Base transaction data
            transaction_data = {
                "transaction_id": parent_payment,
                "order_id": parent_payment,
                "amount": float(amount) if amount else 0.0,
                "currency": currency or "USD",
                "status": normalized_status,
                "time": create_time,
                "update_time": update_time,
                "user_email": user_email or "unknown@example.com",
                "payment_method": "paypal",
                "event_type": event_type,
                "created_on": create_time,
                "name": f"{payer_info.get('first_name', '')} {payer_info.get('last_name', '')}".strip() or "Anonymous",
            }
            
            # Determine payment type
            if payment_session or bulk_registration:
                # This is an event registration payment
                session = payment_session or bulk_registration
                event_id = session.get("event_id")
                user_uid = session.get("user_uid")
                
                if event_id:
                    event = await get_event_by_id(event_id)
                    
                    transaction_data.update({
                        "type": "one-time",
                        "payment_type": "event_registration",
                        "event_id": event_id,
                        "event_name": event.name if event else "Unknown Event",
                        "user_uid": user_uid,
                        "fund_name": f"Event: {event.name if event else 'Unknown Event'}",
                        "note": f"Event registration payment - {event_type}",
                        "metadata": {
                            "registration_count": session.get("registration_count", 1),
                            "event_fee_total": float(amount) if amount else 0.0,
                            "donation_total": 0.0,
                            "bulk_registration": session.get("registration_count", 1) > 1,
                            "webhook_created": True,
                            "webhook_type": "money-webhook"
                        }
                    })
                    
                    logging.info(f"🎫 Event registration money webhook - Event: {event_id}, User: {user_uid}")
                else:
                    # Event session without event_id - treat as donation
                    transaction_data.update({
                        "type": "one-time",
                        "payment_type": "donation",
                        "fund_name": "General",
                        "note": f"Donation payment - {event_type}"
                    })
            else:
                # Check if this might be a subscription payment
                subscription_transactions = await DB.db["donations_subscriptions"].find_one({
                    "$or": [
                        {"last_webhook_transaction_id": transaction_id},
                        {"subscription_id": {"$regex": parent_payment}},
                    ]
                })
                
                if subscription_transactions:
                    # This is a subscription payment
                    transaction_data.update({
                        "type": "subscription",
                        "payment_type": "subscription",
                        "fund_name": "Subscription Payment",
                        "note": f"Subscription payment - {event_type}"
                    })
                    logging.info(f"💳 Subscription money webhook - Transaction: {transaction_id}")
                else:
                    # Unknown payment type - treat as general donation
                    transaction_data.update({
                        "type": "one-time",
                        "payment_type": "donation",
                        "fund_name": "General",
                        "note": f"Unknown payment type - {event_type} (no session found)"
                    })
                    logging.info(f"❓ Unknown payment type money webhook - Transaction: {transaction_id}")
            
            # Create the transaction
            saved_transaction = await Transaction.save_paypal_transaction(transaction_data)
            
            if saved_transaction:
                logging.info(f"✅ Money webhook created transaction: {saved_transaction.transaction_id}")
                return {
                    "success": True, 
                    "action": "transaction_created",
                    "event_type": event_type, 
                    "order_id": parent_payment, 
                    "transaction_id": transaction_id,
                    "payment_type": transaction_data.get("payment_type", "unknown")
                }
            else:
                logging.error("❌ Failed to create transaction from money webhook")
                return {"success": False, "message": "Failed to create transaction"}
        
        return {"success": False, "message": "Event not handled"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ PayPal money webhook error: {str(e)}")
        return {"success": False, "message": f"Webhook processing error: {str(e)}"}