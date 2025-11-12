# controllers/paypal_webhook_controller.py
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple
from datetime import datetime
from mongo.database import DB
from models.donation_subscription import set_subscription_status, upsert_subscription_record
from models.donation_transaction import mark_donation_captured
from bson import ObjectId

# ---------- helpers to extract useful bits from the event ----------

def _get_event_type(evt: Dict[str, Any]) -> str:
    return (evt or {}).get("event_type") or ""

def _res(evt: Dict[str, Any]) -> Dict[str, Any]:
    return (evt or {}).get("resource") or {}

def _safe_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0

def _extract_order_id(event: Dict[str, Any]) -> Optional[str]:
    """
    For PAYMENT.CAPTURE.* events, PayPal often puts the order id under:
      resource.supplementary_data.related_ids.order_id
    Fallbacks are added for safety.
    """
    r = _res(event)
    sup = (r.get("supplementary_data") or {}).get("related_ids") or {}
    order_id = sup.get("order_id")
    if order_id:
        return order_id
    # fallback: custom fields if you set them on the purchase_units
    try:
        pu = (r.get("links") or [])
        # As a last resort, we don't guess. Better to return None than mis-associate.
    except Exception:
        pass
    return None

def _extract_capture_id(event: Dict[str, Any]) -> Optional[str]:
    return _res(event).get("id")

def _extract_subscription_id_from_payment(event: Dict[str, Any]) -> Optional[str]:
    r = _res(event)
    # Older payloads: billing_agreement_id; newer may include subscription_id
    return r.get("subscription_id") or r.get("billing_agreement_id")

def _extract_amount_currency(event: Dict[str, Any]) -> Tuple[float, str]:
    r = _res(event)
    amount = r.get("amount") or {}
    # can be { total, currency } or { value, currency_code }
    v = amount.get("value", amount.get("total"))
    c = amount.get("currency_code", amount.get("currency", "USD"))
    return _safe_float(v), (c or "USD")

# ---------- ORDER (one-time) updates across donations/forms/events ----------

async def _mark_order_capture_everywhere(order_id: str, capture_id: str, raw_event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Try to mark capture idempotently in all three ledgers. We don't know a priori which
    domain an order belonged to, so we update whichever doc matches by order_id.
    """
    now = datetime.utcnow()
    updated = {"donation": False, "form": False, "event": False}

    # donations (your helper already provides a function)
    res = await DB.db.donation_transactions.find_one_and_update(
        {"paypal_order_id": order_id},
        {"$set": {"status": "captured", "paypal_capture_id": capture_id, "capture_payload": raw_event, "updated_at": now}},
        return_document=True,
    )
    updated["donation"] = bool(res)

    # forms
    res = await DB.db.form_transactions.find_one_and_update(
        {"paypal_order_id": order_id},
        {"$set": {"status": "captured", "paypal_capture_id": capture_id, "paypal_capture_payload": raw_event, "updated_at": now}},
        return_document=True,
    )
    updated["form"] = bool(res)

    # events
    res = await DB.db.event_transactions.find_one_and_update(
        {"paypal_order_id": order_id},
        {"$set": {"status": "captured", "paypal_capture_id": capture_id, "paypal_capture_payload": raw_event, "updated_at": now}},
        return_document=True,
    )
    updated["event"] = bool(res)

    return updated

async def _mark_order_refund_everywhere(capture_or_sale_id: str, amount: float, currency: str, raw_event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Record refunds against capture id where present. Implemented as append-only logs.
    """
    now = datetime.utcnow()
    result = {"donation": 0, "form": 0, "event": 0}

    for coll in ("donation_transactions", "form_transactions", "event_transactions"):
        upd = await DB.db[coll].update_many(
            {"paypal_capture_id": capture_or_sale_id},
            {"$push": {"refunds": {"paypal_refund_payload": raw_event, "amount": amount, "currency": currency, "at": now}},
             "$set": {"updated_at": now}}
        )
        result["donation" if coll.startswith("donation") else "form" if coll.startswith("form") else "event"] = upd.modified_count

    return result

# ---------- SUBSCRIPTION lifecycle + payments ----------

async def _set_subscription_status(sub_id: str, status: str) -> None:
    await set_subscription_status(paypal_subscription_id=sub_id, status=status)

async def _record_subscription_payment(event: Dict[str, Any]) -> None:
    """
    Store each successful subscription charge exactly once.
    """
    r = _res(event)
    txn_id = r.get("id")
    if not txn_id:
        return
    sub_id = _extract_subscription_id_from_payment(event)
    amount, currency = _extract_amount_currency(event)

    await DB.db.donation_subscription_payments.update_one(
        {"paypal_txn_id": txn_id},
        {"$setOnInsert": {
            "paypal_txn_id": txn_id,
            "paypal_subscription_id": sub_id,
            "amount": amount,
            "currency": currency,
            "raw": r,
            "created_at": datetime.utcnow(),
        }},
        upsert=True,
    )

# ---------- dispatcher ----------

async def handle_paypal_event(event: Dict[str, Any]) -> Dict[str, Any]:
    et = _get_event_type(event)

    # ---- Subscription lifecycle ----
    if et == "BILLING.SUBSCRIPTION.ACTIVATED":
        sub_id = _res(event).get("id") or _res(event).get("subscription_id")
        if sub_id:
            await _set_subscription_status(sub_id, "ACTIVE")
            return {"handled": "subscription_activated", "subscription_id": sub_id}

    elif et == "BILLING.SUBSCRIPTION.SUSPENDED":
        sub_id = _res(event).get("id") or _res(event).get("subscription_id")
        if sub_id:
            await _set_subscription_status(sub_id, "SUSPENDED")
            return {"handled": "subscription_suspended", "subscription_id": sub_id}

    elif et == "BILLING.SUBSCRIPTION.CANCELLED":
        sub_id = _res(event).get("id") or _res(event).get("subscription_id")
        if sub_id:
            await _set_subscription_status(sub_id, "CANCELLED")
            return {"handled": "subscription_cancelled", "subscription_id": sub_id}

    elif et == "BILLING.SUBSCRIPTION.EXPIRED":
        sub_id = _res(event).get("id") or _res(event).get("subscription_id")
        if sub_id:
            await _set_subscription_status(sub_id, "EXPIRED")
            return {"handled": "subscription_expired", "subscription_id": sub_id}

    # ---- Subscription payments ----
    elif et == "PAYMENT.SALE.COMPLETED":
        # For subscription renewals; one-time sales (legacy) may also land here
        sub_id = _extract_subscription_id_from_payment(event)
        if sub_id:
            await _record_subscription_payment(event)
            return {"handled": "subscription_payment_completed", "subscription_id": sub_id}
        # else fall through; not a sub sale (legacy sale flow) — you can ignore or handle separately

    elif et == "PAYMENT.SALE.REFUNDED" or et == "PAYMENT.SALE.REVERSED":
        # mark refunded subscription payment if you want; captures are handled below
        amount, currency = _extract_amount_currency(event)
        # store in subscription_payments as refunded
        txn_id = _res(event).get("id")
        if txn_id:
            await DB.db.donation_subscription_payments.update_one(
                {"paypal_txn_id": txn_id},
                {"$set": {"refunded": True, "refund_payload": _res(event), "refunded_at": datetime.utcnow()}},
                upsert=True,
            )
            return {"handled": "subscription_payment_refund", "txn_id": txn_id}

    # ---- One-time captures (donations/forms/events) ----
    elif et == "PAYMENT.CAPTURE.COMPLETED":
        order_id = _extract_order_id(event)
        capture_id = _extract_capture_id(event)
        if capture_id:
            # idempotent updates across ledgers
            updated = await _mark_order_capture_everywhere(order_id or "", capture_id, event)
            return {"handled": "capture_completed", "order_id": order_id, "capture_id": capture_id, "updated": updated}

    elif et == "PAYMENT.CAPTURE.DENIED":
        # Optionally flip local rows to failed; often you'll wait for retried capture
        return {"handled": "capture_denied"}

    elif et == "PAYMENT.CAPTURE.REFUNDED" or et == "PAYMENT.CAPTURE.REVERSED":
        cap_id = _extract_capture_id(event) or ""
        amount, currency = _extract_amount_currency(event)
        updated = await _mark_order_refund_everywhere(cap_id, amount, currency, event)
        return {"handled": "capture_refund", "capture_id": cap_id, "updated": updated}

    # ---- Disputes (optional) ----
    elif et.startswith("CUSTOMER.DISPUTE."):
        # You can mirror dispute status on the transaction rows if desired
        return {"handled": "dispute_event", "type": et}

    # Unknown/unhandled event — we accept but mark.
    return {"handled": "ignored", "type": et}
