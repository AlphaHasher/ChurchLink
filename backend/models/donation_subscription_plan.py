from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal, Any, Dict
from pydantic import BaseModel, Field

from mongo.database import DB

Interval = Literal["WEEK", "MONTH", "YEAR"]


class DonationSubscriptionPlan(BaseModel):
    id: Optional[Any] = Field(default=None, alias="_id")

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


async def get_plan(*, currency: str, interval: str, amount: float) -> Optional[dict]:
    q = {
        "currency": currency.upper(),
        "interval": interval.upper(),
        "amount": float(amount),
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