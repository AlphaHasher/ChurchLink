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
)

from helpers.PayPalHelperV2 import PayPalHelperV2

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


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
