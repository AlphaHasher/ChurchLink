import os
import logging
from fastapi import APIRouter, Request, Query, Body, Depends, HTTPException
from typing import Optional, Dict, List, Any
from helpers.paypalHelper import (
    create_order as paypal_create_order,
    capture_order as paypal_capture_order,
    update_transaction_status_api as paypal_update_transaction_status,
    get_transaction_by_id as paypal_get_transaction_by_id,
    list_all_transactions as paypal_list_all_transactions,
    create_subscription_helper as paypal_create_subscription_helper,
    execute_subscription_helper as paypal_execute_subscription_helper,
    get_all_subscriptions_helper as paypal_get_all_subscriptions_helper
)
from mongo.database import DB

paypal_router = APIRouter(prefix="/paypal", tags=["paypal"])

@paypal_router.post("/orders", status_code=200)
async def create_order(request: Request):
    return await paypal_create_order(request)

# ------------------------------------------------------------------------------
# Endpoint to Capture the Payment for an Order
# ------------------------------------------------------------------------------
@paypal_router.post("/orders/{payment_id}/capture", status_code=200)
async def capture_order(payment_id: str, payer_id: str = Query(...)):
    return await paypal_capture_order(payment_id, payer_id)


# ------------------------------------------------------------------------------
# Endpoint to Get Transaction by transaction_id
# ------------------------------------------------------------------------------
@paypal_router.get("/transaction/{transaction_id}", status_code=200)
async def get_transaction_by_id(transaction_id: str):
    return await paypal_get_transaction_by_id(transaction_id)

# ------------------------------------------------------------------------------
# Endpoint to Create a Subscription
# ------------------------------------------------------------------------------
@paypal_router.post("/subscription", status_code=200)
async def create_subscription(request: Request):
    return await paypal_create_subscription_helper(request)

# ------------------------------------------------------------------------------
# Endpoint to Execute a Subscription after approval
# ------------------------------------------------------------------------------
@paypal_router.post("/subscription/execute", status_code=200)
async def execute_subscription(token: str = Query(..., description="PayPal approval token")):
    return await paypal_execute_subscription_helper(token)


# ------------------------------------------------------------------------------
# Endpoint to Get Available Fund Purposes
# ------------------------------------------------------------------------------
@paypal_router.get("/fund-purposes", status_code=200)
async def get_fund_purposes():
    """
    Get all available fund purposes that can be donated to.
    These are defined in the settings collection with a built-in default.
    """
    # Try to get from settings first
    settings = await DB.get_paypal_settings()
    if settings and "ALLOWED_FUNDS" in settings:
        return settings["ALLOWED_FUNDS"]
        
    # Use built-in default instead of environment variable
    default_funds = ["General", "Building", "Missions", "Youth", "Other"]
    return default_funds