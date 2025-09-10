from models.donation_subscription import (
    DonationSubscription,
    get_donation_subscriptions_by_email,
    update_donation_subscription_field
)
import os
import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from helpers.paypal_transaction_helper import save_paypal_transaction
import paypalrestsdk

subscription_router = APIRouter(prefix="/paypal/subscription", tags=["paypal-subscription"])

paypalrestsdk.configure({
    "mode": os.getenv("PAYPAL_MODE", "sandbox"),  # sandbox or live
    "client_id": os.getenv("PAYPAL_CLIENT_ID"),
    "client_secret": os.getenv("PAYPAL_CLIENT_SECRET"),
})

@subscription_router.post("/create", status_code=200)
async def create_subscription(request: Request):
    """
    Accepts: {
        "donation": {
            "fund_name": str,
            "donor_name": str (can be 'pending' or empty, will be updated after PayPal approval),
            "amount": float,
            "message": str,
            "recurrence": str  # "monthly", "quarterly", "annually"
        }
    }
    Returns: PayPal subscription approval link or error
    """
    try:
        request_body = await request.json()
        donation = request_body.get("donation")
        if not donation or not isinstance(donation, dict):
            return JSONResponse(status_code=400, content={"error": "Missing or invalid donation object."})

        fund_name = donation.get("fund_name")
        donor_name = donation.get("donor_name")
        amount = donation.get("amount")
        message = donation.get("message", "")
        recurrence = donation.get("recurrence")
        cycles = donation.get("cycles")

        # Allow donor_name to be 'pending' or empty for initial creation
        if not fund_name or not amount or not recurrence:
            return JSONResponse(status_code=400, content={"error": "fund_name, amount, and recurrence are required."})
        # If donor_name is missing, set to 'pending'
        if not donor_name:
            donor_name = "pending"
        # Validate cycles
        try:
            cycles = int(cycles)
            if cycles <= 0:
                cycles = 9999
        except (TypeError, ValueError):
            cycles = 9999
        try:
            amount = float(amount)
        except ValueError:
            return JSONResponse(status_code=400, content={"error": "Amount must be a number."})
        if amount <= 0:
            return JSONResponse(status_code=400, content={"error": "Amount must be greater than zero."})
        allowed_recurrences = ["monthly", "quarterly", "annually", "weekly", "bi-monthly", "bi-weekly"]
        if recurrence not in allowed_recurrences:
            return JSONResponse(status_code=400, content={"error": f"Recurrence must be one of: {', '.join(allowed_recurrences)}."})

        # Map recurrence to PayPal interval/frequency
        interval_map = {
            "monthly": {"interval": "Month", "frequency": "1"},
            "quarterly": {"interval": "Month", "frequency": "3"},
            "annually": {"interval": "Year", "frequency": "1"},
            "weekly": {"interval": "Week", "frequency": "1"},
            "bi-monthly": {"interval": "Month", "frequency": "2"},
            "bi-weekly": {"interval": "Week", "frequency": "2"},
        }
        interval = interval_map[recurrence]["interval"]
        frequency = interval_map[recurrence]["frequency"]

        plan = paypalrestsdk.BillingPlan({
            "name": f"{fund_name} Donation Subscription",
            "description": f"Recurring donation to {fund_name}",
            "type": "fixed",
            "payment_definitions": [
                {
                    "name": "Regular Payments",
                    "type": "REGULAR",
                    "frequency": interval,
                    "frequency_interval": frequency,
                    "amount": {"value": str(amount), "currency": "USD"},
                    "cycles": str(cycles)
                }
            ],
            "merchant_preferences": {
                "setup_fee": {"value": "0", "currency": "USD"},
                "cancel_url": donation.get("cancel_url", "https://yourchurch.org/donation/cancel"),
                "return_url": donation.get("return_url", "https://yourchurch.org/donation/success"),
                "max_fail_attempts": "0",
                "auto_bill_amount": "YES",
                "initial_fail_amount_action": "CONTINUE"
            }
        })
        if not plan.create():
            logging.error(plan.error)
            return JSONResponse(status_code=500, content={"error": "Failed to create billing plan.", "details": plan.error})

        # Activate the plan
        if plan.state != "ACTIVE":
            if not plan.activate():
                logging.error(plan.error)
                return JSONResponse(status_code=500, content={"error": "Failed to activate billing plan.", "details": plan.error})

        # Create billing agreement
        agreement = paypalrestsdk.BillingAgreement({
            "name": f"{fund_name} Donation Agreement",
            "description": f"Recurring donation to {fund_name} by {donor_name}. Message: {message}",
            "start_date": "2025-09-08T00:00:00Z",  # Should be at least 1 min in future
            "plan": {"id": plan.id},
            "payer": {"payment_method": "paypal"},
        })
        if not agreement.create():
            logging.error(agreement.error)
            return JSONResponse(status_code=500, content={"error": "Failed to create billing agreement.", "details": agreement.error})

        # Get approval URL
        approval_url = next((link.href for link in agreement.links if link.rel == "approval_url"), None)

        # Save subscription donation to MongoDB
        agreement_dict = agreement.to_dict()
        donation_data = {
            "user_email": donor_name,
            "amount": amount,
            "status": agreement_dict.get("state", "pending"),
            "time": agreement_dict.get("start_date", ""),
            "payment_method": "paypal",
            "type": "subscription",
            "subscription_id": agreement_dict.get("id"),
            "plan_id": plan.id,
            "start_time": agreement_dict.get("start_date", ""),
            "next_billing_time": None,
            "cycles": cycles
        }
        await save_paypal_transaction(donation_data)

        return JSONResponse(content={"approval_url": approval_url, "agreement": agreement_dict})
    except Exception as e:
        logging.exception("Error creating PayPal subscription")
        return JSONResponse(status_code=500, content={"error": str(e)})