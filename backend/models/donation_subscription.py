from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Literal, Any, Dict
from pydantic import BaseModel, Field
from bson import ObjectId

from mongo.database import DB

"""
Ledger for PayPal Subscriptions (v1 /billing/subscriptions).

Notes:
- We do not manage Products/Plans here. The controller creates the Subscription directly and
  records the returned `id` plus status. We support per-donor amount via plan-price override
  (if enabled) or by provisioning multiple plan ids out-of-band.
- Webhooks (BILLING.SUBSCRIPTION.* and PAYMENT.SALE.COMPLETED) should upsert rows via the helpers below.
"""

SubStatus = Literal["APPROVAL_PENDING", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"]


class DonationSubscription(BaseModel):
    id: Optional[Any] = Field(default=None, alias="_id")

    # PayPal subscription id
    paypal_subscription_id: str
    status: SubStatus

    # donor + org
    donor_uid: Optional[str] = None
    merchant_org_id: Optional[str] = None

    # money + cadence
    amount: float
    currency: Literal["USD"] = "USD"
    interval: Literal["MONTH", "YEAR", "WEEK"] = "MONTH"

    # optional donor message
    message: Optional[str] = None

    # arbitrary bag
    meta: Dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo(self) -> Dict[str, Any]:
        return self.dict(by_alias=True, exclude_none=True)


async def upsert_subscription_record(
    *,
    paypal_subscription_id: str,
    status: str,
    donor_uid: Optional[str],
    amount: float,
    currency: str = "USD",
    interval: str = "MONTH",
    merchant_org_id: Optional[str] = None,
    message: Optional[str] = None,
    meta: Optional[dict] = None,
):
    now = datetime.utcnow()
    doc = {
        "paypal_subscription_id": paypal_subscription_id,
        "status": status,
        "donor_uid": ObjectId(donor_uid) if donor_uid and ObjectId.is_valid(donor_uid) else donor_uid,
        "merchant_org_id": ObjectId(merchant_org_id) if merchant_org_id and ObjectId.is_valid(merchant_org_id) else merchant_org_id,
        "amount": float(amount),
        "currency": currency,
        "interval": interval,
        "message": message,
        "meta": meta or {},
        "updated_at": now,
    }
    existing = await DB.db.donation_subscriptions.find_one({"paypal_subscription_id": paypal_subscription_id})
    if existing:
        await DB.db.donation_subscriptions.update_one({"_id": existing["_id"]}, {"$set": doc})
        existing.update(doc)
        return existing
    else:
        doc["created_at"] = now
        res = await DB.db.donation_subscriptions.insert_one(doc)
        doc["_id"] = res.inserted_id
        return doc


async def set_subscription_status(*, paypal_subscription_id: str, status: str):
    return await DB.db.donation_subscriptions.find_one_and_update(
        {"paypal_subscription_id": paypal_subscription_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}},
        return_document=True,
    )


async def get_subscription_by_id(paypal_subscription_id: str) -> Optional[dict]:
    return await DB.db.donation_subscriptions.find_one({"paypal_subscription_id": paypal_subscription_id})
