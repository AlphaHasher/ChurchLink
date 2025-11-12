from __future__ import annotations

from typing import Optional, Dict, Any
from fastapi import HTTPException

from helpers.PayPalHelperV2 import PayPalHelperV2
from models.donation_subscription_plan import get_plan, save_plan

# You can brand these however you want:
PRODUCT_NAME = "Donations"
PRODUCT_TYPE = "SERVICE"  # PayPal accepted type

async def _ensure_product(helper: PayPalHelperV2, merchant_org_id: Optional[str]) -> str:
    """
    Find or create a PayPal Product for this org in Mongo 'settings' or in the plans collection.
    To keep it simple, we key off the first plan for an org; if none exists, we create a product.
    """
    # try to discover an existing product_id from any plan for this org
    q = {
        "merchant_org_id": merchant_org_id,
    }
    any_plan = await helper.db.db.donation_subscription_plans.find_one(q) if hasattr(helper, "db") else None  # helper may not expose DB; safe guard
    if any_plan and any_plan.get("product_id"):
        return any_plan["product_id"]

    # Create a new Product
    payload = {
        "name": PRODUCT_NAME if not merchant_org_id else f"{PRODUCT_NAME} ({merchant_org_id})",
        "type": PRODUCT_TYPE,
        "category": "SOFTWARE",  # arbitrary permitted category
    }
    resp = await helper.post("/v1/catalogs/products", payload)
    if resp.status_code not in (200, 201):
        raise HTTPException(502, detail={"error": "paypal_create_product_failed", "body": resp.text})

    product = resp.json()
    product_id = product.get("id")
    if not product_id:
        raise HTTPException(502, detail="PayPal product create returned no id")
    return product_id


async def ensure_fixed_amount_plan(
    *,
    helper: PayPalHelperV2,
    merchant_org_id: Optional[str],
    currency: str,
    interval: str,
    amount: float,
) -> str:
    """
    Reuse an ACTIVE fixed-price plan if one exists; otherwise create + activate one and store in Mongo.
    """
    currency = currency.upper()
    interval = interval.upper()

    # 1) fast path: cached plan in Mongo
    existing = await get_plan(merchant_org_id, currency=currency, interval=interval, amount=amount)
    if existing and existing.get("plan_id"):
        return existing["plan_id"]

    # 2) ensure product
    product_id = await _ensure_product(helper, merchant_org_id)

    # 3) create plan (fixed price per interval)
    plan_payload = {
        "product_id": product_id,
        "name": f"Donation {currency} {amount:.2f} / {interval}",
        "status": "CREATED",
        "billing_cycles": [
            {
                "frequency": {"interval_unit": interval, "interval_count": 1},
                "tenure_type": "REGULAR",
                "sequence": 1,
                "total_cycles": 0,  # 0 → infinite
                "pricing_scheme": {
                    "fixed_price": {"value": f"{amount:.2f}", "currency_code": currency}
                },
            }
        ],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 3,
        },
        # taxes/trials optional
    }

    resp = await helper.post("/v1/billing/plans", plan_payload)
    if resp.status_code not in (200, 201):
        raise HTTPException(502, detail={"error": "paypal_create_plan_failed", "body": resp.text})

    plan = resp.json()
    plan_id = plan.get("id")
    if not plan_id:
        raise HTTPException(502, detail="PayPal plan create returned no id")

    # 4) activate the plan
    act = await helper.post(f"/v1/billing/plans/{plan_id}/activate", {})
    if act.status_code not in (204, 200):
        # Some tenants return 204 No Content on success
        raise HTTPException(502, detail={"error": "paypal_activate_plan_failed", "body": act.text})

    # 5) save in Mongo for future reuse
    doc = {
        "merchant_org_id": merchant_org_id,
        "product_id": product_id,
        "plan_id": plan_id,
        "currency": currency,
        "interval": interval,
        "amount": float(amount),
        "status": "ACTIVE",
        "meta": {},
    }
    await save_plan(doc)

    return plan_id