from fastapi import APIRouter, Query, Body, HTTPException
from typing import Optional, Dict, Any
from helpers.paypalHelper import (
    update_transaction_status_api as paypal_update_transaction_status,
    get_transaction_by_id as paypal_get_transaction_by_id,
    list_all_transactions as paypal_list_all_transactions,
    get_all_subscriptions_helper as paypal_get_all_subscriptions_helper
)
from mongo.database import DB

paypal_admin_router = APIRouter(prefix="/paypal_admin", tags=["paypal-admin"])

# ------------------------------------------------------------------------------
# Endpoint to Update Transaction Status (refund/cancel/etc)
# ------------------------------------------------------------------------------
@paypal_admin_router.post("/transaction/{transaction_id}/status", status_code=200)
async def update_transaction_status(
    transaction_id: str, 
    status: str = Body(...), 
    reason: Optional[str] = Body(None)
):
    return await paypal_update_transaction_status(transaction_id, status, reason)

# ------------------------------------------------------------------------------
# Admin Dashboard: List All Transactions
# ------------------------------------------------------------------------------
@paypal_admin_router.get("/admin/transactions", status_code=200)
async def list_all_transactions(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(20, description="Maximum number of records to return"),
    fund_name: Optional[str] = Query(None, description="Filter by fund name"),
    status: Optional[str] = Query(None, description="Filter by transaction status")
):
    return await paypal_list_all_transactions(skip, limit, fund_name, status)

# ------------------------------------------------------------------------------
# Endpoint to Get Transaction by transaction_id
# ------------------------------------------------------------------------------
@paypal_admin_router.get("/transaction/{transaction_id}", status_code=200)
async def get_transaction_by_id(transaction_id: str):
    return await paypal_get_transaction_by_id(transaction_id)

# ------------------------------------------------------------------------------
# Admin Dashboard: List All Subscriptions
# ------------------------------------------------------------------------------
@paypal_admin_router.get("/admin/subscriptions", status_code=200)
async def get_all_subscriptions(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(20, description="Maximum number of records to return"),
    status: Optional[str] = Query(None, description="Filter by subscription status"),
    fund_name: Optional[str] = Query(None, description="Filter by fund name")
):
    return await paypal_get_all_subscriptions_helper(skip, limit, status, fund_name)

