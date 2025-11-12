'''
from fastapi import APIRouter, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from models.donation_subscription import DonationSubscription
from models.transaction import Transaction, PaymentStatus  
import logging
import json
import os
import httpx
from datetime import datetime, timedelta
from models.event import get_event_by_id
from mongo.database import DB
from bson.objectid import ObjectId
from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url

paypal_subscription_webhook_router = APIRouter(prefix="/paypal/subscription", tags=["paypal_subscription_webhook"])

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
            logging.error("❌ Missing required PayPal subscription webhook signature headers")
            return False
        
        # Check for replay attacks using transmission ID
        is_new_transmission = await check_and_record_transmission_id(transmission_id)
        if not is_new_transmission:
            logging.error(f"❌ PayPal subscription webhook replay attack detected - transmission ID: {transmission_id[:10]}...")
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
            logging.error("❌ Missing PayPal webhook ID configuration for subscription webhooks")
            return False
        
        # Get PayPal access token (wrapped to prevent blocking the event loop)
        access_token = await run_in_threadpool(get_paypal_access_token)
        if not access_token:
            logging.error("❌ Failed to get PayPal access token for subscription webhook verification")
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
            logging.error(f"❌ PayPal subscription webhook verification API error: {response.status_code}")
            return False
        
        verification_result = response.json()
        verification_status = verification_result.get("verification_status")
        
        if verification_status == "SUCCESS":
            logging.info(f"✅ PayPal subscription webhook signature verified successfully - ID: {transmission_id[:10]}...")
            return True
        else:
            logging.error(f"❌ PayPal subscription webhook signature verification failed: {verification_status}")
            return False
        
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
            "paypal-cert-url": request.headers.get("paypal-cert-url"),
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
            "paypal-cert-url": request.headers.get("paypal-cert-url"),
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
    '''