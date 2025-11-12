from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Literal, Any, Dict
from bson import ObjectId
from pydantic import BaseModel, Field

from mongo.database import DB

"""
A lightweight ledger for one-time donations captured via PayPal Orders v2.

Lifecycle:
- "created": PayPal order created (no funds captured)
- "captured": PayPal order captured (we store the capture id)
- "failed": error during capture/creation
- "refunded": reserved for future use (admin refund flow can append a refund log)
"""

DonationTxnStatus = Literal["created", "captured", "failed", "refunded"]


class DonationTransaction(BaseModel):
    id: Optional[Any] = Field(default=None, alias="_id")
    status: DonationTxnStatus = "created"

    # PayPal ids
    paypal_order_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None

    # Who gave + who will be able to refund later
    donor_uid: Optional[str] = None          # user uid if authenticated; optional for anonymous
    merchant_org_id: Optional[str] = None    # optional: owning org / church id

    # Money
    amount: float
    currency: Literal["USD"] = "USD"

    # Optional context
    message: Optional[str] = None            # donor-supplied message
    meta: Dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo(self) -> Dict[str, Any]:
        return self.dict(by_alias=True, exclude_none=True)


async def create_donation_transaction(
    *,
    amount: float,
    currency: str = "USD",
    donor_uid: Optional[str],
    merchant_org_id: Optional[str] = None,
    message: Optional[str] = None,
    paypal_order_id: Optional[str] = None,
    meta: Optional[dict] = None,
) -> dict:
    doc = {
        "status": "created",
        "amount": float(amount),
        "currency": currency,
        "donor_uid": ObjectId(donor_uid) if donor_uid and ObjectId.is_valid(donor_uid) else donor_uid,
        "merchant_org_id": ObjectId(merchant_org_id) if merchant_org_id and ObjectId.is_valid(merchant_org_id) else merchant_org_id,
        "message": message,
        "paypal_order_id": paypal_order_id,
        "paypal_capture_id": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "meta": meta or {},
    }
    res = await DB.db.donation_transactions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def mark_donation_captured(
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
    return await DB.db.donation_transactions.find_one_and_update(
        {"paypal_order_id": paypal_order_id}, update, return_document=True
    )


async def mark_donation_failed(
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
    return await DB.db.donation_transactions.find_one_and_update(q, update, return_document=True)


async def get_donation_transaction_by_order_id(paypal_order_id: str) -> Optional[dict]:
    return await DB.db.donation_transactions.find_one({"paypal_order_id": paypal_order_id})
