import os
import logging
from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from models.transaction import Transaction
from bson import ObjectId
import paypalrestsdk
import logging

paypal_router = APIRouter(prefix="/paypal", tags=["paypal"])

paypalrestsdk.configure({
    "mode": os.getenv("PAYPAL_MODE", "sandbox"),
    "client_id": os.getenv("PAYPAL_CLIENT_ID"),
    "client_secret": os.getenv("PAYPAL_CLIENT_SECRET"),
})

# ------------------------------------------------------------------------------
# Endpoint to Create an Order
# ------------------------------------------------------------------------------
@paypal_router.post("/orders", status_code=200)
async def create_order(request: Request):
    try:
        request_body = await request.json()
        donation = request_body.get("donation")
        if not donation or not isinstance(donation, dict):
            return JSONResponse(status_code=400, content={"error": "Missing or invalid donation object."})

        fund_name = donation.get("fund_name")
        donor_name = donation.get("donor_name")
        amount = donation.get("amount")
        message = donation.get("message", "")

        if not fund_name or not amount:
            return JSONResponse(status_code=400, content={"error": "fund_name and amount are required."})
        try:
            amount = float(amount)
        except ValueError:
            return JSONResponse(status_code=400, content={"error": "Amount must be a number."})
        if amount <= 0:
            return JSONResponse(status_code=400, content={"error": "Amount must be greater than zero."})

        payment = paypalrestsdk.Payment({
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "transactions": [
                {
                    "amount": {
                        "total": str(amount),
                        "currency": "USD"
                    },
                    "description": f"Donation to {fund_name} by {donor_name}. Message: {message}",
                    "item_list": {
                        "items": [
                            {
                                "name": f"Donation: {fund_name}",
                                "sku": "donation",
                                "price": str(amount),
                                "currency": "USD",
                                "quantity": 1
                            }
                        ]
                    }
                }
            ],
            "redirect_urls": {
                "cancel_url": donation.get("cancel_url", "https://yourchurch.org/donation/cancel"),
                "return_url": donation.get("return_url", "https://yourchurch.org/donation/success"),
            }
        })
        if payment.create():
            approval_url = next((link.href for link in payment.links if link.rel == "approval_url"), None)
            return JSONResponse(content={"approval_url": approval_url, "payment_id": payment.id})
        else:
            logging.error(payment.error)
            return JSONResponse(status_code=500, content={"error": "Failed to create PayPal payment.", "details": payment.error})
    except Exception as e:
        logging.exception("Error creating PayPal payment")
        return JSONResponse(status_code=500, content={"error": str(e)})

# ------------------------------------------------------------------------------
# Endpoint to Capture the Payment for an Order
# ------------------------------------------------------------------------------
@paypal_router.post("/orders/{payment_id}/capture", status_code=200)
async def capture_order(payment_id: str, payer_id: str = Query(...)):
    try:
        if not payment_id or not payer_id:
            logging.error(f"[capture_order] Missing payment_id or payer_id: payment_id={payment_id}, payer_id={payer_id}")
            return JSONResponse(status_code=400, content={"error": "Missing payment_id or payer_id."})
        payment = paypalrestsdk.Payment.find(payment_id)
        if payment.execute({"payer_id": payer_id}):
            transaction = payment.to_dict()
            payer_info = transaction.get("payer", {}).get("payer_info", {})
            funding_instruments = transaction.get("payer", {}).get("funding_instruments", [{}])
            address = payer_info.get("shipping_address", {})
            card_type = funding_instruments[0].get("credit_card", {}).get("type", "")
            user_email = payer_info.get("email", None)
            if not user_email:
                original = await Transaction.get_transactions_by_email(user_email)
                donor_name = None
                for d in original:
                    if d.order_id == payment_id:
                        donor_name = d.user_email
                        break
                user_email = donor_name or ""
            transaction_data = {
                "transaction_id": payment_id,
                "user_email": user_email,
                "amount": transaction.get("transactions", [{}])[0].get("amount", {}).get("total", 0),
                "status": transaction.get("state", "completed"),
                "time": transaction.get("create_time", ""),
                "payment_method": "paypal",
                "type": "one-time",
                "order_id": payment_id,
                "payer_name": payer_info.get("first_name", "") + " " + payer_info.get("last_name", ""),
                "address": address,
                "card_type": card_type,
                "user_id": transaction.get("user_id"),
            }
            await Transaction.create_transaction(Transaction(**transaction_data))
            return JSONResponse(content={"status": "success", "payment": transaction})
        else:
            logging.error(f"[capture_order] PayPal payment execution failed. payment_id={payment_id}, payer_id={payer_id}, error={payment.error}")
            return JSONResponse(status_code=422, content={"error": "Unprocessable Content", "details": payment.error})
    except Exception as e:
        logging.exception("Error executing PayPal payment")
        return JSONResponse(status_code=500, content={"error": str(e)})
    
# ------------------------------------------------------------------------------
# Endpoint to Update Transaction Status (refund/cancel/etc)
# ------------------------------------------------------------------------------
@paypal_router.post("/transaction/{transaction_id}/status", status_code=200)
async def update_transaction_status_api(transaction_id: str, status: str):
    result = await Transaction.update_transaction_status(transaction_id, status)
    if result:
        return JSONResponse(content={"success": True, "transaction_id": transaction_id, "status": status})
    return JSONResponse(status_code=404, content={"error": "Transaction not found"})

# ------------------------------------------------------------------------------
# Admin Dashboard: List All Transactions
# ------------------------------------------------------------------------------
@paypal_router.get("/admin/transactions", status_code=200)
async def list_all_transactions():
    transactions = await Transaction.get_transactions_by_email()  # Get all transactions
    logging.info(f"Fetched {len(transactions)} transactions from DB")
    for t in transactions:
        logging.info(f"Transaction: {t.model_dump()}")
    result = []
    for t in transactions:
        # Ensure created_on is a string
        if hasattr(t.created_on, "isoformat"):
            t.created_on = t.created_on.isoformat()
        result.append(t)
    return {"transactions": [tx.model_dump() for tx in result]}

# ------------------------------------------------------------------------------
# Endpoint to Get Transaction by transaction_id
# ------------------------------------------------------------------------------
@paypal_router.get("/transaction/{transaction_id}", status_code=200)
async def get_transaction_by_id(transaction_id: str):
    tx = await Transaction.get_transaction_by_id(transaction_id)
    if tx:
        # Ensure created_on is a string
        if hasattr(tx.created_on, "isoformat"):
            tx.created_on = tx.created_on.isoformat()
        return {"transaction": tx.model_dump()}
    return JSONResponse(status_code=404, content={"error": "Transaction not found"})