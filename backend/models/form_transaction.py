# models/form_transaction.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal, Any
from bson import ObjectId

from mongo.database import DB

"""
A lightweight clone of event_transaction, tuned for forms.

Lifecycle:
- "created": PayPal order created (no funds captured)
- "captured": PayPal order captured
- "failed": error during capture/creation
"""

FormTxnStatus = Literal["created", "captured", "failed"]


async def create_form_transaction(
    *,
    form_id: str,
    user_id: Optional[str],
    amount: float,
    currency: str = "USD",
    paypal_order_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    doc = {
        "form_id": ObjectId(form_id) if ObjectId.is_valid(form_id) else form_id,
        "user_id": ObjectId(user_id) if (user_id and ObjectId.is_valid(user_id)) else user_id,
        "status": "created",
        "amount": float(amount),
        "currency": currency,
        "paypal_order_id": paypal_order_id,
        "paypal_capture_id": None,
        "metadata": metadata or {},
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "fail_reason": None,
    }
    res = await DB.db.form_transactions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def mark_form_transaction_captured(
    *, paypal_order_id: str, capture_id: str, capture_payload: dict | None = None
) -> Optional[dict]:
    update = {
        "$set": {
            "status": "captured",
            "paypal_capture_id": capture_id,
            "capture_payload": capture_payload or {},
            "updated_at": datetime.utcnow(),
        }
    }
    res = await DB.db.form_transactions.find_one_and_update(
        {"paypal_order_id": paypal_order_id}, update, return_document=True
    )
    return res


async def mark_form_transaction_failed(
    *, paypal_order_id: Optional[str], reason: str, payload: dict | None = None
) -> Optional[dict]:
    q = {"paypal_order_id": paypal_order_id} if paypal_order_id else {}
    update = {
        "$set": {
            "status": "failed",
            "fail_reason": reason,
            "failure_payload": payload or {},
            "updated_at": datetime.utcnow(),
        }
    }
    res = await DB.db.form_transactions.find_one_and_update(q, update, return_document=True)
    return res


async def get_form_transaction_by_order_id(paypal_order_id: str) -> Optional[dict]:
    return await DB.db.form_transactions.find_one({"paypal_order_id": paypal_order_id})
