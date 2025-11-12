from __future__ import annotations

import os
from typing import Optional, Dict, Any, Literal
from uuid import uuid4

from fastapi import HTTPException, Request, status
from pydantic import BaseModel, Field

from helpers.PayPalHelperV2 import PayPalHelperV2
from models.donation_transaction import (
    create_donation_transaction,
    mark_donation_captured,
    mark_donation_failed,
    get_donation_transaction_by_order_id,
)
from models.donation_subscription import (
    upsert_subscription_record,
    set_subscription_status,
)

from helpers.DonationPlanHelper import ensure_fixed_amount_plan

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

SUPPORTED_INTERVALS = {"MONTH", "YEAR", "WEEK"}


class CreateDonationOrder(BaseModel):
    amount: float = Field(gt=0.0)
    currency: str = "USD"
    message: Optional[str] = None
    merchant_org_id: Optional[str] = None


class CaptureDonation(BaseModel):
    order_id: str


class CreateDonationSubscription(BaseModel):
    amount: float = Field(gt=0.0)
    currency: str = "USD"
    interval: Literal["MONTH", "YEAR", "WEEK"] = "MONTH"
    message: Optional[str] = None
    merchant_org_id: Optional[str] = None


async def _pp() -> PayPalHelperV2:
    inst = await PayPalHelperV2.get_instance()
    await inst.start()
    return inst


# ----------------------------
# One-time donation (Orders v2)
# ----------------------------

async def create_paypal_order_for_donation(*, request: Request, body: CreateDonationOrder) -> dict:
    helper = await _pp()
    amount = float(body.amount)
    currency = (body.currency or "USD").upper()

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {"currency_code": currency, "value": f"{amount:.2f}"},
                "custom_id": str(body.merchant_org_id or "donation"),
                "description": "One-time Donation",
            }
        ],
        "application_context": {
            "brand_name": "Donation",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
            "return_url": f"{FRONTEND_URL}/donations/one-time/success",
            "cancel_url": f"{FRONTEND_URL}/donations/one-time/cancel",
        },
    }

    req_id = f"donation:create:{uuid4().hex[:8]}"
    try:
        resp = await helper.post("/v2/checkout/orders", order_payload, request_id=req_id)
        if resp.status_code >= 300:
            raise RuntimeError(resp.text)
        order = resp.json()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"PayPal order creation failed: {e}")

    order_id = (order or {}).get("id")
    if not order_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid PayPal response (missing id)")

    await create_donation_transaction(
        amount=amount,
        currency=currency,
        donor_uid=request.state.uid,
        merchant_org_id=body.merchant_org_id,
        message=(body.message or "").strip() or None,
        paypal_order_id=order_id,
        meta={"flow": "one_time_donation"},
    )
    return {"order_id": order_id, "paypal": order, "amount": amount, "currency": currency}


async def capture_paypal_order_for_donation(*, request: Request, body: CaptureDonation) -> dict:
    txn = await get_donation_transaction_by_order_id(body.order_id)
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    helper = await _pp()

    # short-circuit if idempotent
    if (txn.get("status") == "captured") and txn.get("paypal_capture_id"):
        return {
            "status": "already_captured",
            "order_id": body.order_id,
            "capture_id": txn["paypal_capture_id"],
            "amount": txn.get("amount"),
            "currency": txn.get("currency", "USD"),
        }

    req_id = f"donation:capture:{body.order_id}"
    try:
        resp = await helper.post(f"/v2/checkout/orders/{body.order_id}/capture", json_body={}, request_id=req_id)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"status={resp.status_code} body={resp.text}")
        cap = resp.json()
    except Exception as e:
        await mark_donation_failed(paypal_order_id=body.order_id, reason="paypal_capture_error", payload={"error": str(e)})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"PayPal capture failed: {e}")

    # extract capture id + amount
    capture_id = None
    captured_amount = None
    try:
        # walk to first CAPTURE object
        for pu in cap.get("purchase_units", []):
            for p in pu.get("payments", {}).get("captures", []):
                if p.get("status") in ("COMPLETED", "PENDING", "PARTIALLY_REFUNDED"):
                    capture_id = p.get("id")
                    amt = p.get("amount") or {}
                    captured_amount = float(amt.get("value", "0"))
                    break
            if capture_id:
                break
    except Exception:
        pass

    if not capture_id:
        await mark_donation_failed(paypal_order_id=body.order_id, reason="missing_capture_id", payload=cap)
        raise HTTPException(status_code=502, detail="Invalid PayPal response (no capture)")

    await mark_donation_captured(paypal_order_id=body.order_id, capture_id=capture_id, capture_payload=cap)

    return {
        "status": "captured",
        "order_id": body.order_id,
        "capture_id": capture_id,
        "captured_amount": captured_amount,
        "currency": txn.get("currency", "USD"),
    }


# ----------------------------
# Recurring donation (Subscriptions v1)
# ----------------------------

async def create_subscription_and_return_approval(*, request: Request, body: CreateDonationSubscription) -> dict:
    helper = await _pp()
    interval = body.interval.upper()
    if interval not in SUPPORTED_INTERVALS:
        raise HTTPException(422, detail=f"Unsupported interval {interval}")

    # 1) find-or-create a fixed-price plan for this (org, currency, interval, amount)
    plan_id = await ensure_fixed_amount_plan(
        helper=helper,
        merchant_org_id=body.merchant_org_id,
        currency=(body.currency or "USD"),
        interval=interval,
        amount=float(body.amount),
    )

    # 2) create the subscription pointing at that plan
    payload = {
        "application_context": {
            "brand_name": "Donation Subscription",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "SUBSCRIBE_NOW",
            "return_url": f"{FRONTEND_URL}/donations/subscription/success",
            "cancel_url": f"{FRONTEND_URL}/donations/subscription/cancel",
        },
        "custom_id": (body.merchant_org_id or "donation"),
        "plan_id": plan_id,
        # (no quantity, price is fixed in the plan)
    }

    req_id = f"donation:sub:create:{uuid4().hex[:8]}"
    resp = await helper.post("/v1/billing/subscriptions", payload, request_id=req_id)
    if resp.status_code not in (201, 200):
        raise HTTPException(502, detail={"error": "paypal_create_subscription_failed", "body": resp.text})
    sub = resp.json()

    sub_id = sub.get("id")
    status = sub.get("status", "APPROVAL_PENDING")
    if not sub_id:
        raise HTTPException(502, detail="Invalid PayPal response (missing subscription id)")

    await upsert_subscription_record(
        paypal_subscription_id=sub_id,
        status=status,
        donor_uid=request.state.uid,
        amount=float(body.amount),
        currency=(body.currency or "USD").upper(),
        interval=interval,
        merchant_org_id=body.merchant_org_id,
        message=(body.message or "").strip() or None,
        meta={"flow": "donation_subscription", "plan_id": plan_id},
    )

    approval = None
    for link in sub.get("links", []):
        if link.get("rel") == "approve":
            approval = link.get("href"); break

    return {"subscription_id": sub_id, "status": status, "approve_url": approval, "paypal": sub}

# These can be used by webhook handlers later:

async def mark_subscription_active(*, paypal_subscription_id: str):
    await set_subscription_status(paypal_subscription_id=paypal_subscription_id, status="ACTIVE")


async def mark_subscription_cancelled(*, paypal_subscription_id: str):
    await set_subscription_status(paypal_subscription_id=paypal_subscription_id, status="CANCELLED")
