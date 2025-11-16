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
    record_donation_refund
)
from models.donation_subscription import (
    upsert_subscription_record,
    set_subscription_status,
    get_subscription_by_id
)

from models.donation_subscription_payment import record_subscription_payment_refund

from mongo.database import DB

from helpers.DonationPlanHelper import ensure_fixed_amount_plan

from models.refund_models import TransactionRefund


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

SUPPORTED_INTERVALS = {"MONTH", "YEAR", "WEEK"}


class CreateDonationOrder(BaseModel):
    amount: float = Field(gt=0.0)
    currency: str = "USD"
    message: Optional[str] = None


class CaptureDonation(BaseModel):
    order_id: str


class CreateDonationSubscription(BaseModel):
    amount: float = Field(gt=0.0)
    currency: str = "USD"
    interval: Literal["MONTH", "YEAR", "WEEK"] = "MONTH"
    message: Optional[str] = None

class CancelDonationSubscription(BaseModel):
    subscription_id: str

class AdminRefundOneTimeDonation(BaseModel):
    # We target the PayPal capture id (what _mark_order_refund_everywhere uses)
    paypal_capture_id: str
    # Optional partial refund. If None ⇒ full refund.
    amount: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = None


class AdminRefundDonationSubscriptionPayment(BaseModel):
    # For subscription charges we record PayPal SALE id as paypal_txn_id
    paypal_txn_id: str
    # Optional partial refund. If None ⇒ full refund.
    amount: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = None


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
                "custom_id": "donation",
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

    donor_uid = getattr(request.state, "uid", None)

    await create_donation_transaction(
        amount=amount,
        currency=currency,
        donor_uid=donor_uid,
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

    # 1) find-or-create a fixed-price plan for this (currency, interval, amount)
    plan_id = await ensure_fixed_amount_plan(
        helper=helper,
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
        "custom_id": "donation",
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

    donor_uid = getattr(request.state, "uid", None)

    await upsert_subscription_record(
        paypal_subscription_id=sub_id,
        status=status,
        donor_uid=donor_uid,
        amount=float(body.amount),
        currency=(body.currency or "USD").upper(),
        interval=interval,
        message=(body.message or "").strip() or None,
        meta={"flow": "donation_subscription", "plan_id": plan_id},
    )

    approval = None
    for link in sub.get("links", []):
        if link.get("rel") == "approve":
            approval = link.get("href")
            break

    return {"subscription_id": sub_id, "status": status, "approve_url": approval, "paypal": sub}

async def cancel_donation_subscription(
    *, request: Request, body: CancelDonationSubscription, admin_override:bool=False
) -> Dict[str, Any]:
    helper = await _pp()
    sub_id = body.subscription_id

    uid = getattr(request.state, "uid", None)
    sub_doc = await get_subscription_by_id(sub_id)
    if not sub_doc:
        raise HTTPException(404, "Subscription not found")

    donor_uid = sub_doc.get("donor_uid")

    if not admin_override:  # user path
        if uid is None:
            raise HTTPException(401, "Authentication required")
        if donor_uid is None or uid != donor_uid:
            raise HTTPException(403, "You are not allowed to cancel this subscription")

    # Call PayPal
    payload = {"reason": "User requested cancellation"}
    resp = await helper.post(
        f"/v1/billing/subscriptions/{sub_id}/cancel",
        json_body=payload,
    )
    if resp.status_code not in (200, 204):
        try:
            data = resp.json()
        except Exception:
            data = {"raw": await resp.text()}
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"msg": "Failed to cancel subscription with PayPal", "paypal": data},
        )

    # Update local ledger
    await mark_subscription_cancelled(paypal_subscription_id=sub_id)

    return {"success": True, "status": "CANCELLED"}

async def admin_refund_one_time_donation(
    *,
    request: Request,
    body: AdminRefundOneTimeDonation,
) -> Dict[str, Any]:
    """
    Admin-triggered refund for a one-time donation.

    - If amount is None => refund the remaining refundable amount.
    - If amount is set => partial refund of that amount.
    - We immediately append a refund entry into donation_transactions, and
      still rely on PAYMENTS.CAPTURE.REFUNDED webhooks as a safety net.
    """
    paypal_capture_id = (body.paypal_capture_id or "").strip()
    if not paypal_capture_id:
        raise HTTPException(status_code=400, detail="paypal_capture_id is required")

    # Make sure we know which transaction this capture belongs to
    txn_doc = await DB.db.donation_transactions.find_one({"paypal_capture_id": paypal_capture_id})
    if not txn_doc:
        raise HTTPException(
            status_code=404,
            detail="Donation transaction not found for that capture id",
        )

    original_amount = float(txn_doc.get("amount", 0.0) or 0.0)
    currency = str(txn_doc.get("currency") or "USD")

    # Compute how much has already been refunded for this transaction
    refunds_raw = txn_doc.get("refunds") or []
    refunded_total = 0.0
    if isinstance(refunds_raw, list):
        for r in refunds_raw:
            if not isinstance(r, dict):
                continue
            try:
                refunded_total += float(r.get("amount", 0.0) or 0.0)
            except (TypeError, ValueError):
                continue
    refunded_total = round(refunded_total, 2)

    remaining = round(original_amount - refunded_total, 2)
    if remaining <= 0.01:
        raise HTTPException(
            status_code=400,
            detail="Nothing left to refund for this donation",
        )

    # Determine the refund amount we will request from PayPal
    if body.amount is not None:
        value = round(float(body.amount), 2)
        if value <= 0:
            raise HTTPException(status_code=400, detail="Refund amount must be > 0")

        # Do not allow more than the remaining refundable amount
        if value - remaining > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Refund amount cannot exceed remaining refundable amount ({remaining:.2f})",
            )
    else:
        # No explicit amount => refund whatever remains
        value = remaining

    json_body: Dict[str, Any] = {
        "amount": {
            "value": f"{value:.2f}",
            "currency_code": currency,
        }
    }

    helper = await PayPalHelperV2.get_instance()
    try:
        resp = await helper.post(
            f"/v2/payments/captures/{paypal_capture_id}/refund",
            json_body=json_body,
            request_id=f"admin-refund-donation:{paypal_capture_id}:{uuid4().hex}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "PayPal refund request failed", "error": str(e)},
        )

    if resp.status_code not in (200, 201):
        try:
            payload = resp.json()
        except Exception:
            payload = {"raw": await resp.text()}
        raise HTTPException(
            status_code=502,
            detail={
                "message": "PayPal refund failed",
                "status_code": resp.status_code,
                "paypal_response": payload,
            },
        )

    data = resp.json() or {}

    # Build refund log entry
    amount_info = (data.get("amount") or {}) or {}
    raw_value = amount_info.get("value")
    refund_value = float(raw_value) if raw_value is not None else float(value)
    refund_currency = str(amount_info.get("currency_code") or currency)
    refund_id = data.get("id") or f"paypal:{paypal_capture_id}:{uuid4().hex}"
    reason = (
        (body.reason or "").strip()
        or data.get("reason")
        or "admin_manual_refund"
    )
    admin_uid = getattr(request.state, "uid", None)

    refund_entry = TransactionRefund(
        refund_id=str(refund_id),
        amount=refund_value,
        currency=refund_currency,  # should be "USD"
        reason=reason,
        by_uid=str(admin_uid) if admin_uid is not None else None,
        source="admin_api",
        paypal_refund_payload=data,
    )

    # Persist refund into donation_transactions
    try:
        await record_donation_refund(
            paypal_capture_id=paypal_capture_id,
            refund=refund_entry,
        )
    except Exception:
        # If Mongo update fails, the refund at PayPal is still valid.
        # You may want to log this properly; we just don't mask the refund.
        pass

    return {
        "success": True,
        "paypal_capture_id": paypal_capture_id,
        "paypal_refund": data,
    }

async def admin_refund_donation_subscription_payment(
    *,
    request: Request,
    body: AdminRefundDonationSubscriptionPayment,
) -> Dict[str, Any]:
    """
    Admin-triggered refund for a single subscription payment (SALE).

    - If amount is None => refund the remaining refundable amount.
    - If amount is set => partial refund of that amount.
    - We immediately append a refund entry into donation_subscription_payments,
      and still rely on PAYMENT.SALE.REFUNDED webhooks as a safety net.
    """
    paypal_txn_id = (body.paypal_txn_id or "").strip()
    if not paypal_txn_id:
        raise HTTPException(status_code=400, detail="paypal_txn_id is required")

    # Fetch the payment row so we know original amount / currency
    pay_doc = await DB.db.donation_subscription_payments.find_one({"paypal_txn_id": paypal_txn_id})
    if not pay_doc:
        raise HTTPException(
            status_code=404,
            detail="Subscription payment not found for that paypal_txn_id",
        )

    original_amount = float(pay_doc.get("amount", 0.0) or 0.0)
    currency = str(pay_doc.get("currency") or "USD")

    # Compute how much has already been refunded for this payment
    refunds_raw = pay_doc.get("refunds") or []
    refunded_total = 0.0
    if isinstance(refunds_raw, list):
        for r in refunds_raw:
            if not isinstance(r, dict):
                continue
            try:
                refunded_total += float(r.get("amount", 0.0) or 0.0)
            except (TypeError, ValueError):
                continue
    else:
        refunds_raw = []

    refunded_total = round(refunded_total, 2)

    # Legacy compatibility: if we have no structured refunds but the legacy
    # boolean 'refunded' is set, assume a full refund already occurred.
    if not refunds_raw and pay_doc.get("refunded"):
        refunded_total = original_amount

    remaining = round(original_amount - refunded_total, 2)
    if remaining <= 0.01:
        raise HTTPException(
            status_code=400,
            detail="Nothing left to refund for this subscription payment",
        )

    # Determine the refund amount we will request from PayPal
    if body.amount is not None:
        value = round(float(body.amount), 2)
        if value <= 0:
            raise HTTPException(status_code=400, detail="Refund amount must be > 0")

        if value - remaining > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Refund amount cannot exceed remaining refundable amount ({remaining:.2f})",
            )
    else:
        value = remaining

    # v1 sale refund body always provides an explicit amount
    json_body: Dict[str, Any] = {
        "amount": {
            "total": f"{value:.2f}",
            "currency": currency,
        }
    }

    helper = await PayPalHelperV2.get_instance()
    try:
        # For subscription payments we use v1 /payments/sale/{sale_id}/refund
        resp = await helper.post(
            f"/v1/payments/sale/{paypal_txn_id}/refund",
            json_body=json_body,
            request_id=f"admin-refund-sub-payment:{paypal_txn_id}:{uuid4().hex}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "PayPal refund request failed", "error": str(e)},
        )

    if resp.status_code not in (200, 201):
        try:
            payload = resp.json()
        except Exception:
            payload = {"raw": await resp.text()}
        raise HTTPException(
            status_code=502,
            detail={
                "message": "PayPal refund failed",
                "status_code": resp.status_code,
                "paypal_response": payload,
            },
        )

    data = resp.json() or {}

    amount_info = (data.get("amount") or {}) or {}
    raw_total = amount_info.get("total")
    refund_value = float(raw_total) if raw_total is not None else float(value)
    refund_currency = str(amount_info.get("currency") or currency)
    refund_id = data.get("id") or f"paypal:{paypal_txn_id}:{uuid4().hex}"
    reason = (
        (body.reason or "").strip()
        or data.get("reason")
        or "admin_manual_refund"
    )
    admin_uid = getattr(request.state, "uid", None)

    refund_entry = TransactionRefund(
        refund_id=str(refund_id),
        amount=refund_value,
        currency=refund_currency,
        reason=reason,
        by_uid=str(admin_uid) if admin_uid is not None else None,
        source="admin_api",
        paypal_refund_payload=data,
    )

    try:
        await record_subscription_payment_refund(
            paypal_txn_id=paypal_txn_id,
            refund=refund_entry,
        )
    except Exception:
        # Same deal: don't hide a successful PayPal refund behind a local DB error.
        pass

    return {
        "success": True,
        "paypal_txn_id": paypal_txn_id,
        "paypal_refund": data,
    }


# These can be used by webhook handlers

async def mark_subscription_active(*, paypal_subscription_id: str):
    await set_subscription_status(paypal_subscription_id=paypal_subscription_id, status="ACTIVE")


async def mark_subscription_cancelled(*, paypal_subscription_id: str):
    await set_subscription_status(paypal_subscription_id=paypal_subscription_id, status="CANCELLED")
