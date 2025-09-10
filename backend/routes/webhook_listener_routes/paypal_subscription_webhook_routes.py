from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from models.donation_subscription import DonationSubscription

paypal_subscription_webhook_router = APIRouter(prefix="/paypal/subscription", tags=["paypal_subscription_webhook"])

@paypal_subscription_webhook_router.post("/webhook", status_code=200)
async def paypal_subscription_webhook(request: Request):
    payload = await request.json()
    event_type = payload.get("event_type")
    resource = payload.get("resource", {})
    # Handle subscription activation event
    if event_type == "BILLING.SUBSCRIPTION.ACTIVATED":
        subscription_id = resource.get("id")
        payer_info = resource.get("subscriber", {}).get("name", {})
        payer_name = f"{payer_info.get('given_name', '')} {payer_info.get('surname', '')}".strip()
        subscriptions = await DonationSubscription.get_donation_subscriptions_by_email("")
        # Try to match by subscription_id first
        for sub in subscriptions:
            if sub.subscription_id == subscription_id:
                await DonationSubscription.update_donation_subscription_field(sub.id, "user_email", payer_name)
                return {"success": True, "subscription_id": sub.id, "donor_name": payer_name}
        # If not found, try to match by user_email and status (pending) and update subscription_id
        for sub in subscriptions:
            if not sub.subscription_id and sub.user_email == payer_name and sub.status == "pending":
                await DonationSubscription.update_donation_subscription_field(sub.id, "subscription_id", subscription_id)
                await DonationSubscription.update_donation_subscription_field(sub.id, "user_email", payer_name)
                return {"success": True, "subscription_id": sub.id, "donor_name": payer_name, "subscription_id": subscription_id}
        return {"success": False, "message": "Subscription not found for subscription_id"}
    # Handle payment succeeded event to update next_billing_time
    elif event_type == "BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED":
        subscription_id = resource.get("billing_agreement_id") or resource.get("id")
        next_billing_time = resource.get("next_billing_time")
        subscriptions = await DonationSubscription.get_donation_subscriptions_by_email("")
        for sub in subscriptions:
            if sub.subscription_id == subscription_id:
                await DonationSubscription.update_donation_subscription_field(sub.id, "next_billing_time", next_billing_time)
                return {"success": True, "subscription_id": sub.id, "next_billing_time": next_billing_time}
        return {"success": False, "message": "Subscription not found for subscription_id"}
    return {"success": False, "message": "Event not handled"}

@paypal_subscription_webhook_router.post("/money-webhook", status_code=200)
async def paypal_money_webhook(request: Request):
    payload = await request.json()
    event_type = payload.get("event_type")
    resource = payload.get("resource", {})
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
        # Save to MongoDB (or update subscription record)
        # You may want to call a transaction handler here
        return {"success": True, "event_type": event_type, "order_id": parent_payment, "transaction_id": transaction_id}
    return {"success": False, "message": "Event not handled"}
