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
