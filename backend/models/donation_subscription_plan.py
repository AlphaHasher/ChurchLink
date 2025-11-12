# models/donation_subscription_plan.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal, Any, Dict
from pydantic import BaseModel, Field
from bson import ObjectId

from mongo.database import DB

Interval = Literal["WEEK", "MONTH", "YEAR"]

class DonationSubscriptionPlan(BaseModel):
    id: Optional[Any] = Field(default=None, alias="_id")

    merchant_org_id: Optional[str] = None  # null → global/default
    product_id: str                        # PayPal product id
    plan_id: str                           # PayPal plan id

    currency: str = "USD"
    interval: Interval = "MONTH"
    amount: float = 0.0                    # fixed price per interval

    status: Literal["ACTIVE", "INACTIVE", "CREATED"] = "ACTIVE"
    meta: Dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_mongo(self):
        return self.dict(by_alias=True, exclude_none=True)


async def get_plan(merchant_org_id: Optional[str], *, currency: str, interval: str, amount: float) -> Optional[dict]:
    q = {
        "currency": currency.upper(),
        "interval": interval.upper(),
        "amount": float(amount),
        "merchant_org_id": ObjectId(merchant_org_id) if merchant_org_id and ObjectId.is_valid(merchant_org_id) else merchant_org_id,
        "status": "ACTIVE",
    }
    return await DB.db.donation_subscription_plans.find_one(q)


async def save_plan(doc: dict) -> dict:
    now = datetime.utcnow()
    doc.setdefault("created_at", now)
    doc["updated_at"] = now
    res = await DB.db.donation_subscription_plans.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def ensure_indexes():
    # Unique “plan key” so we never create duplicates:
    # org + currency + interval + amount (org can be null)
    await DB.db.donation_subscription_plans.create_index(
        [
            ("merchant_org_id", 1),
            ("currency", 1),
            ("interval", 1),
            ("amount", 1),
        ],
        name="uniq_org_currency_interval_amount",
        unique=True,
        partialFilterExpression={"status": {"$exists": True}},
    )
