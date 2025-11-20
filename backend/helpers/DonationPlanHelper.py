from __future__ import annotations

from typing import Optional, Dict, Any
from fastapi import HTTPException

from helpers.PayPalHelperV2 import PayPalHelperV2
from models.donation_subscription_plan import get_plan, save_plan
from mongo.database import DB


PRODUCT_NAME = "Donations"
PRODUCT_TYPE = "SERVICE"  # PayPal accepted type


async def _ensure_product(helper: PayPalHelperV2) -> str:
    """
    Find or create a global PayPal Product in Mongo based on existing plans.
    """
    any_plan = await DB.db.donation_subscription_plans.find_one({})
    if any_plan and any_plan.get("product_id"):
        return any_plan["product_id"]

    payload = {
        "name": PRODUCT_NAME,
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


async def _mark_plan_invalid(plan_doc: dict, reason: str, raw: dict | None = None) -> None:
    """
    Flip this plan out of ACTIVE so we don't keep reusing it if PayPal says it's bad.
    """
    if not plan_doc.get("_id"):
        return

    await DB.db.donation_subscription_plans.update_one(
        {"_id": plan_doc["_id"]},
        {
            "$set": {
                "status": "INVALID",
                "meta.invalid_reason": reason,
                "meta.invalid_payload": raw or {},
            }
        },
    )


async def _fetch_paypal_plan(helper: PayPalHelperV2, plan_id: str) -> Optional[dict]:
    """
    Get the PayPal plan or return None if it clearly doesn't exist.
    """
    # Assumes PayPalHelperV2 has a .get method similar to .post
    resp = await helper.get(f"/v1/billing/plans/{plan_id}")

    if resp.status_code == 200:
        return resp.json()

    # Plan is gone or not accessible in a way that means "don't use this anymore".
    if resp.status_code in (404, 410):
        return None

    # For "normal" 4xx (bad id, forbidden, etc) just treat as non-usable as well.
    if 400 <= resp.status_code < 500:
        return None

    # 5xx / network-ish from PayPal → bubble as infra error instead of silently
    # burning through plan ids.
    raise HTTPException(
        502,
        detail={
            "error": "paypal_get_plan_failed",
            "status": resp.status_code,
            "body": resp.text,
        },
    )


def _paypal_plan_matches_request(
    paypal_plan: dict,
    *,
    currency: str,
    interval: str,
    amount: float,
) -> bool:
    """
    Check that the PayPal plan actually matches the (currency, interval, amount)
    we expect for this donation tier.
    """
    try:
        if paypal_plan.get("status") != "ACTIVE":
            return False

        billing_cycles = paypal_plan.get("billing_cycles") or []
        if not billing_cycles:
            return False

        cycle = billing_cycles[0]
        freq = cycle.get("frequency") or {}
        pricing_scheme = (cycle.get("pricing_scheme") or {}).get("fixed_price") or {}

        interval_unit = (freq.get("interval_unit") or "").upper()
        if interval_unit != interval.upper():
            return False

        pp_currency = (pricing_scheme.get("currency_code") or "").upper()
        if pp_currency != currency.upper():
            return False

        value_raw = pricing_scheme.get("value")
        value = float(str(value_raw)) if value_raw is not None else None
        if value is None:
            return False

        if abs(value - float(amount)) > 1e-6:
            return False

        return True
    except Exception:
        # If we can't parse it in a reasonable way, don't trust it.
        return False


async def ensure_fixed_amount_plan(
    *,
    helper: PayPalHelperV2,
    currency: str,
    interval: str,
    amount: float,
) -> str:
    """
    Reuse an ACTIVE fixed-price plan if one exists both in Mongo *and* in PayPal;
    otherwise create + activate one and store in Mongo.
    """
    currency = currency.upper()
    interval = interval.upper()

    # 1) fast path: cached plan in Mongo
    existing = await get_plan(currency=currency, interval=interval, amount=amount)
    if existing and existing.get("plan_id"):
        plan_id = existing["plan_id"]

        # 1a) verify with PayPal that this plan actually exists + matches our settings
        paypal_plan = await _fetch_paypal_plan(helper, plan_id)

        if paypal_plan and _paypal_plan_matches_request(
            paypal_plan,
            currency=currency,
            interval=interval,
            amount=amount,
        ):
            # looks good – reuse it
            return plan_id

        # Otherwise, mark this plan invalid and fall through to create a new one
        await _mark_plan_invalid(
            existing,
            reason="paypal_plan_missing_or_mismatched",
            raw=paypal_plan,
        )

    # 2) ensure product
    product_id = await _ensure_product(helper)

    # 3) create plan (fixed price per interval)
    plan_payload: Dict[str, Any] = {
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
        raise HTTPException(502, detail={"error": "paypal_activate_plan_failed", "body": act.text})

    # 5) save in Mongo for future reuse
    doc = {
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
