from __future__ import annotations

import os
from typing import Optional, Dict, Any
from uuid import uuid4

from fastapi import HTTPException, Request, status

from models.form import (
    get_form_by_slug,
    add_response_by_slug
)
from models.form_transaction import (
    create_form_transaction,
    mark_form_transaction_captured,
    mark_form_transaction_failed,
    get_form_transaction_by_order_id,
    record_form_refund
)

from models.refund_models import TransactionRefund

from pydantic import BaseModel

from helpers.PayPalHelperV2 import PayPalHelperV2

from mongo.database import DB

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class AdminRefundFormPayment(BaseModel):
    """
    Admin-triggered refund for a PayPal form payment.

    - paypal_capture_id: the PayPal capture id we stored on the form transaction.
    - amount: optional partial refund amount. If None => full refund.
    - reason: optional free-text reason (for internal logs / future use).
    """
    paypal_capture_id: str
    amount: Optional[float] = None
    reason: Optional[str] = None


# ---------- internal helpers

async def _assert_form_payable(slug: str):
    form = await get_form_by_slug(slug)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if (form.submission_price or 0) <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Form is not configured for payments")
    if "paypal" not in (form.payment_options or []):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Form does not accept PayPal")
    return form


async def _pp() -> PayPalHelperV2:
    inst = await PayPalHelperV2.get_instance()
    await inst.start()
    return inst



async def create_paypal_order_for_form(*, request: Request, slug: str) -> dict:
    form = await _assert_form_payable(slug)
    amount = float(form.submission_price or 0)
    currency = "USD"

    helper = await _pp()

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {"currency_code": currency, "value": f"{amount:.2f}"},
                "custom_id": str(form.id),
                "description": f"Form submission ({slug})",
            }
        ],
        "application_context": {
            "brand_name": "Form Submission",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
            "return_url": f"{FRONTEND_URL}/forms/{slug}/payment/success",
            "cancel_url": f"{FRONTEND_URL}/forms/{slug}/payment/cancel",
        },
    }

    req_id = f"form:create:{slug}:{uuid4().hex[:8]}"
    try:
        resp = await helper.post("/v2/checkout/orders", order_payload, request_id=req_id)
        if resp.status_code >= 300:
            raise RuntimeError(resp.text)
        order = resp.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"PayPal order creation failed: {e}",
        )

    order_id = (order or {}).get("id")
    if not order_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid PayPal response (missing id)")

    await create_form_transaction(
        form_id=form.id,
        user_id=request.state.uid,
        amount=amount,
        currency=currency,
        paypal_order_id=order_id,
        metadata={"slug": slug, "flow": "form_submission"},
    )

    return {"order_id": order_id, "paypal": order, "amount": amount, "currency": currency}


# ---------- NEW: combined capture + submit (idempotent)

async def capture_and_submit_form(
    *,
    request: Request,
    slug: str,
    order_id: str,
    answers: Dict[str, Any],
) -> dict:
    """
    One-shot endpoint:
    - Idempotently captures PayPal order (or short-circuits if already captured)
    - Idempotently writes the form response (or returns the existing response)
    """
    # ensure the form is payable & get configured price/currency
    form = await _assert_form_payable(slug)
    configured_amount = float(form.submission_price or 0)
    configured_currency = "USD"

    # load the provisional transaction created at "create" time
    txn = await get_form_transaction_by_order_id(order_id)
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    helper = await _pp()

    # ---------- (A) Capture idempotency guard
    capture_id = None
    captured_amount = None
    captured_currency = configured_currency

    # If we already captured this order, reuse stored capture info
    if (txn.get("status") == "captured") and txn.get("paypal_capture_id"):
        capture_id = txn.get("paypal_capture_id")
        captured_amount = float(txn.get("amount") or configured_amount)
        captured_currency = txn.get("currency") or configured_currency
    else:
        # Perform PayPal capture
        req_id = f"form:capture:{order_id}"
        try:
            resp = await helper.post(f"/v2/checkout/orders/{order_id}/capture", json_body={}, request_id=req_id)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"status={resp.status_code} body={resp.text}")
            capture = resp.json()
        except Exception as e:
            await mark_form_transaction_failed(
                paypal_order_id=order_id, reason="paypal_capture_error", payload={"error": str(e)}
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"PayPal capture failed: {e}",
            )

        status_str = (capture or {}).get("status")
        normalized = (status_str or "").strip().upper()
        if normalized != "COMPLETED":
            await mark_form_transaction_failed(
                paypal_order_id=order_id, reason=f"paypal_non_completed_status:{status_str}", payload=capture or {}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unexpected PayPal status: {status_str}"
            )

        # Extract capture id & amount/currency
        try:
            pu0 = (capture.get("purchase_units") or [])
            if pu0:
                caps = ((pu0[0].get("payments") or {}).get("captures") or [])
                if caps:
                    cap0 = caps[0]
                    capture_id = cap0.get("id")
                    amt = (cap0.get("amount") or {})
                    val = amt.get("value")
                    ccy = amt.get("currency_code") or configured_currency
                    captured_currency = ccy
                    if val is not None:
                        captured_amount = float(val)
        except Exception:
            pass

        if not capture_id:
            await mark_form_transaction_failed(
                paypal_order_id=order_id, reason="paypal_capture_parse_error", payload=capture or {}
            )
            raise HTTPException(status_code=502, detail="Could not parse PayPal capture response")

        # Sanity check: captured total matches configured total (protects tampering)
        if round(captured_amount or 0.0, 2) != round(configured_amount, 2) or captured_currency != configured_currency:
            await mark_form_transaction_failed(
                paypal_order_id=order_id,
                reason="amount_currency_mismatch",
                payload={
                    "captured_amount": captured_amount,
                    "captured_currency": captured_currency,
                    "configured_amount": configured_amount,
                    "configured_currency": configured_currency,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Captured amount/currency mismatch with configured price.",
            )

        # persist capture
        await mark_form_transaction_captured(
            paypal_order_id=order_id,
            capture_id=capture_id or "unknown",
            capture_payload=capture or {},
        )

    # ---------- (B) Idempotent submit (by transaction_id)
    payment_block: Dict[str, Any] = {
        "payment_type": "paypal",
        "payment_complete": True,
        "transaction_id": capture_id,
        "price": float(captured_amount or configured_amount),
        "currency": captured_currency,
    }

    
    saved = await add_response_by_slug(
        slug=slug,
        user_id=request.state.uid,
        response=answers or {},
        passed_payment=payment_block
    )

    return {
        "status": "captured_and_submitted",
        "order_id": order_id,
        "transaction_id": capture_id,
        "response": saved,
    }

async def admin_refund_form_payment(
    *,
    request: Request,
    body: AdminRefundFormPayment,
) -> Dict[str, Any]:
    """
    Admin refund endpoint for form payments.

    Flow:
      1. Look up the form transaction by paypal_capture_id.
      2. Compute the remaining refundable amount from the ledger.
      3. Build a refund request for PayPal:
         - no amount => refund the remaining amount
         - amount => partial refund of that amount (bounded by remaining)
      4. Call /v2/payments/captures/{capture_id}/refund.
      5. Append a refund record into form_transactions so the ledger reflects it.
    """
    paypal_capture_id = (body.paypal_capture_id or "").strip()
    if not paypal_capture_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="paypal_capture_id is required",
        )

    # Find the form transaction we're refunding
    txn_doc = await DB.db.form_transactions.find_one({"paypal_capture_id": paypal_capture_id})
    if not txn_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form payment not found for that capture id",
        )

    original_amount = float(txn_doc.get("amount", 0.0) or 0.0)
    captured_currency = str(txn_doc.get("currency") or "USD")

    # Compute the total already refunded for this capture
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nothing left to refund for this form payment",
        )

    # Determine how much we want to refund now
    if body.amount is not None:
        value = round(float(body.amount), 2)
        if value <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount must be > 0",
            )

        if value - remaining > 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund amount cannot exceed remaining refundable amount ({remaining:.2f})",
            )
    else:
        value = remaining

    json_body: Dict[str, Any] = {
        "amount": {
            "value": f"{value:.2f}",
            "currency_code": captured_currency,
        }
    }

    helper = await PayPalHelperV2.get_instance()
    req_id = f"admin:form-refund:{paypal_capture_id}:{uuid4().hex}"
    try:
        resp = await helper.post(
            f"/v2/payments/captures/{paypal_capture_id}/refund",
            json_body=json_body,
            request_id=req_id,
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
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "PayPal refund failed",
                "status_code": resp.status_code,
                "paypal_response": payload,
            },
        )

    data = resp.json() or {}

    amount_info = (data.get("amount") or {}) or {}
    raw_value = amount_info.get("value")
    refund_value = float(raw_value) if raw_value is not None else float(value)
    refund_currency = str(amount_info.get("currency_code") or captured_currency)
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
        currency=refund_currency,
        reason=reason,
        by_uid=str(admin_uid) if admin_uid is not None else None,
        source="admin_api",
        paypal_refund_payload=data,
    )

    try:
        await record_form_refund(
            paypal_capture_id=paypal_capture_id,
            refund=refund_entry,
        )
    except Exception:
        #Don't hide a successful PayPal refund behind a local DB hiccup.
        pass

    return {
        "success": True,
        "paypal_capture_id": paypal_capture_id,
        "paypal_refund": data,
    }
