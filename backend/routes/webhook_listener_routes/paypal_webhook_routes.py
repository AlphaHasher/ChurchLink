from fastapi import APIRouter, Request
from models.transaction import Transaction
import logging

paypal_webhook_router = APIRouter(prefix="/paypal", tags=["paypal_webhook"])

@paypal_webhook_router.post("/webhook", status_code=200)
async def paypal_webhook(request: Request):
    payload = await request.json()
    event_type = payload.get("event_type")
    resource = payload.get("resource", {})
    status = None
    query_field = None
    query_value = None

    # Refund event for one-time payment
    if event_type == "PAYMENT.SALE.REFUNDED":
        query_field = "order_id"
        query_value = resource.get("parent_payment")
        status = "refunded"
    # Cancellation event for subscription
    elif event_type == "BILLING.SUBSCRIPTION.CANCELLED":
        query_field = "subscription_id"
        query_value = resource.get("id")
        status = "cancelled"
    # Add more event types as needed

    if query_field and query_value and status:
        transactions = await Transaction.get_transactions_by_email("")  # You may want to filter by query_field/query_value
        for transaction in transactions:
            if getattr(transaction, query_field, None) == query_value:
                transaction_id = transaction.transaction_id
                await Transaction.update_transaction_status(transaction_id, status)
                
                # Log the status update with additional context
                logging.info(f"Webhook updated transaction {transaction_id} status to {status} for {query_field}={query_value}")
                
                return {"success": True, "transaction_id": transaction_id, "status": status}

    return {"success": False, "message": "Event not handled"}
