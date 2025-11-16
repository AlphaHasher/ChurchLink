from __future__ import annotations

from typing import Any, Dict, Optional, Tuple
from datetime import datetime
from mongo.database import DB
from models.donation_subscription import set_subscription_status, upsert_subscription_record, get_subscription_by_id
from models.donation_transaction import mark_donation_captured, record_donation_refund
from bson import ObjectId
from models.donation_subscription_payment import record_subscription_payment_refund

from models.refund_models import TransactionRefund
from models.form_transaction import record_form_refund

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

def _extract_amount_fee_net(event: Dict[str, Any]) -> Tuple[Optional[float], Optional[float], Optional[float], str]:
    """
    Extract gross_amount, fee_amount, net_amount and currency from a webhook event's resource.

    Supports:
    - v2 capture objects with seller_receivable_breakdown
    - legacy sale objects with amount + transaction_fee
    """
    r = _res(event)
    currency = "USD"
    gross: Optional[float] = None
    fee: Optional[float] = None
    net: Optional[float] = None

    # v2 / capture style
    srb = r.get("seller_receivable_breakdown") or {}
    if srb:
        gross_amount = srb.get("gross_amount") or {}
        fee_amount = srb.get("paypal_fee") or srb.get("fee_amount") or {}
        net_amount = srb.get("net_amount") or {}

        v = gross_amount.get("value")
        if v is not None:
            gross = _safe_float(v)
            currency = gross_amount.get("currency_code", currency) or currency

        v = fee_amount.get("value")
        if v is not None:
            fee = _safe_float(v)

        v = net_amount.get("value")
        if v is not None:
            net = _safe_float(v)

    # fallback: generic amount shape
    amount = r.get("amount") or {}
    v = amount.get("value", amount.get("total"))
    if v is not None and gross is None:
        gross = _safe_float(v)
        currency = amount.get("currency_code", amount.get("currency", currency)) or currency

    # legacy sale-style transaction_fee
    txn_fee = r.get("transaction_fee") or {}
    if txn_fee and fee is None:
        v = txn_fee.get("value")
        if v is not None:
            fee = _safe_float(v)

    # derive missing pieces if possible
    if gross is not None and net is None and fee is not None:
        net = round(gross - fee, 2)
    elif gross is not None and net is not None and fee is None:
        fee = round(gross - net, 2)

    return gross, fee, net, currency

# ---------- ORDER (one-time) updates across donations/forms/events ----------

async def _mark_order_capture_everywhere(order_id: str, capture_id: str, raw_event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Try to mark capture idempotently in all three ledgers. We don't know a priori which
    domain an order belonged to, so we update whichever doc matches by order_id.

    Also records gross / fee / net amounts when PayPal provides them.
    """
    now = datetime.utcnow()
    updated = {"donation": False, "form": False, "event": False}

    gross, fee, net, _currency = _extract_amount_fee_net(raw_event)

    def _attach_amounts(set_dict: Dict[str, Any]) -> Dict[str, Any]:
        if gross is not None:
            set_dict["gross_amount"] = gross
        if fee is not None:
            set_dict["fee_amount"] = fee
        if net is not None:
            set_dict["net_amount"] = net
        return set_dict

    # donations
    donation_set: Dict[str, Any] = _attach_amounts(
        {
            "status": "captured",
            "paypal_capture_id": capture_id,
            "capture_payload": raw_event,
            "updated_at": now,
        }
    )
    res = await DB.db.donation_transactions.find_one_and_update(
        {"paypal_order_id": order_id},
        {"$set": donation_set},
        return_document=True,
    )
    updated["donation"] = bool(res)

    # forms
    form_set: Dict[str, Any] = _attach_amounts(
        {
            "status": "captured",
            "paypal_capture_id": capture_id,
            "paypal_capture_payload": raw_event,
            "updated_at": now,
        }
    )
    res = await DB.db.form_transactions.find_one_and_update(
        {"paypal_order_id": order_id},
        {"$set": form_set},
        return_document=True,
    )
    updated["form"] = bool(res)

    # events
    event_set: Dict[str, Any] = _attach_amounts(
        {
            "status": "captured",
            "paypal_capture_id": capture_id,
            "paypal_capture_payload": raw_event,
            "updated_at": now,
        }
    )
    res = await DB.db.event_transactions.find_one_and_update(
        {"paypal_order_id": order_id},
        {"$set": event_set},
        return_document=True,
    )
    updated["event"] = bool(res)

    return updated

async def _mark_order_refund_everywhere(
    capture_or_sale_id: str,
    amount: float,
    currency: str,
    raw_event: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Mirror a PAYMENTS.CAPTURE.REFUNDED / REVERSED event into our ledgers.

    For one-time donations and form payments we now treat webhook refunds as
    additive and idempotent:

    - Each webhook delivery turns into a TransactionRefund with a stable
      refund_id derived from the underlying PayPal refund/resource or from
      the webhook event id.
    - record_donation_refund / record_form_refund are idempotent per
      refund_id, so repeated deliveries of the same webhook do not
      double-count.
    - Multiple distinct refunds on the same capture are represented as
      multiple entries in the refunds array.

    We still do not mutate event ledgers here; events have explicit per-line
    refund flows in event_registration_controller.
    """
    result: Dict[str, int] = {"donation": 0, "form": 0, "event": 0}
    capture_id = (capture_or_sale_id or "").strip()
    if not capture_id:
        return result

    # Normalize amount/currency
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        amt = 0.0
    cur = (currency or "USD").upper()

    raw = raw_event or {}
    resource = raw.get("resource") or {}
    webhook_reason = (
        resource.get("reason")
        or resource.get("reason_code")
        or "paypal_external"
    )

    # Prefer the underlying refund/resource id if present (v2 refund events),
    # otherwise fall back to the webhook event id, and finally a synthetic id.
    event_id = raw.get("id")
    refund_id = (
        str(resource.get("id")) if resource.get("id") else None
    ) or (str(event_id) if event_id is not None else None) or f"webhook_capture:{capture_id}:{datetime.utcnow().isoformat()}"

    def _make_refund_entry() -> TransactionRefund:
        return TransactionRefund(
            refund_id=str(refund_id),
            amount=amt,
            currency=cur,  # type: ignore[arg-type]
            reason=webhook_reason,
            source="webhook_capture_refund",
            paypal_refund_payload=raw_event,
        )

    if amt <= 0:
        return result

    # ----- One-time donations -----
    donation_doc = await DB.db.donation_transactions.find_one({"paypal_capture_id": capture_id})
    if donation_doc is not None:
        updated = await record_donation_refund(
            paypal_capture_id=capture_id,
            refund=_make_refund_entry(),
        )
        if updated:
            result["donation"] = 1

    # ----- Form payments -----
    form_doc = await DB.db.form_transactions.find_one({"paypal_capture_id": capture_id})
    if form_doc is not None:
        updated = await record_form_refund(
            paypal_capture_id=capture_id,
            refund=_make_refund_entry(),
        )
        if updated:
            result["form"] = 1

    # ----- Events -----
    # Event refunds are handled explicitly via event_registration_controller
    # (per-line refunds with append_refund_to_item). We deliberately avoid
    # writing ambiguous capture-level refunds here.
    result["event"] = 0

    return result

# ---------- SUBSCRIPTION lifecycle + payments ----------

async def _set_subscription_status(sub_id: str, status: str) -> None:
    await set_subscription_status(paypal_subscription_id=sub_id, status=status)

async def _record_subscription_payment(event: Dict[str, Any]) -> None:
    """
    Store each successful subscription charge exactly once.

    This:
      - extracts the subscription id + amount/currency/fees
      - looks up the subscription so we can attach donor_uid
      - upserts a row in donation_subscription_payments keyed by paypal_txn_id
    """
    r = _res(event)
    txn_id = r.get("id")
    if not txn_id:
        return

    sub_id = _extract_subscription_id_from_payment(event)
    if not sub_id:
        return

    # Basic amount/currency
    amount, currency = _extract_amount_currency(event)

    # Detailed breakdown if available
    gross, fee, net, fee_currency = _extract_amount_fee_net(event)
    currency = fee_currency or currency or "USD"

    # Fallbacks if PayPal didn't give us everything
    if gross is None:
        gross = amount
    if net is None:
        if gross is not None and fee is not None:
            net = round(gross - (fee or 0.0), 2)
        else:
            net = gross

    # join back to the subscription document so we know which user this belongs to
    sub_doc = await get_subscription_by_id(sub_id)
    donor_uid = sub_doc.get("donor_uid") if sub_doc else None

    now = datetime.utcnow()
    status = r.get("state") or r.get("status") or "COMPLETED"

    await DB.db.donation_subscription_payments.update_one(
        {"paypal_txn_id": txn_id},
        {
            # always bump updated_at / status in case PayPal retries the webhook
            "$set": {
                "status": status,
                "updated_at": now,
            },
            # only set these fields on first insert, to keep the row idempotent
            "$setOnInsert": {
                "paypal_txn_id": txn_id,
                "paypal_subscription_id": sub_id,
                "donor_uid": donor_uid,
                "amount": amount,
                "currency": currency,
                "gross_amount": gross,
                "fee_amount": fee,
                "net_amount": net,
                "raw": r,
                "created_at": now,
            },
        },
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
        # Refund of a subscription SALE (individual payment).
        amount, currency = _extract_amount_currency(event)
        r = _res(event)

        txn_id = r.get("id")
        if not txn_id:
            # No sale id => nothing for us to map back to donation_subscription_payments
            return {"handled": "subscription_payment_refund_ignored", "reason": "missing_txn_id"}

        # See if we already have a row for this sale
        pay_doc = await DB.db.donation_subscription_payments.find_one({"paypal_txn_id": txn_id})

        # If the payment row exists and already has at least one admin_api refund
        # recorded, we assume the admin endpoints are the source of truth and skip
        # webhook-based mirroring to avoid double-counting the same refunds.
        if pay_doc:
            raw_refunds = pay_doc.get("refunds") or []
            has_admin_refund = False
            if isinstance(raw_refunds, list):
                for rr in raw_refunds:
                    if isinstance(rr, dict) and rr.get("source") == "admin_api":
                        has_admin_refund = True
                        break
            if has_admin_refund:
                return {
                    "handled": "subscription_payment_refund_skipped_admin_owned",
                    "txn_id": txn_id,
                }

        # If we have a payment row (normal case), record a structured refund entry.
        if pay_doc:
            cur = (currency or pay_doc.get("currency") or "USD").upper()
            try:
                amt = float(amount)
            except (TypeError, ValueError):
                amt = float(pay_doc.get("amount", 0.0) or 0.0)

            resource = r or {}
            webhook_reason = (
                resource.get("reason")
                or resource.get("reason_code")
                or "paypal_external"
            )

            # Use the webhook event id as the refund_id so that repeated deliveries
            # of the same webhook are idempotent inside record_subscription_payment_refund.
            event_id = (event or {}).get("id")
            refund_id = (
                str(event_id)
                if event_id is not None
                else f"webhook:{txn_id}:{datetime.utcnow().isoformat()}"
            )

            refund_entry = TransactionRefund(
                refund_id=refund_id,
                amount=amt,
                currency=cur,  # type: ignore[arg-type]
                reason=webhook_reason,
                source="webhook_sale_refund",
                paypal_refund_payload=r,
            )

            await record_subscription_payment_refund(
                paypal_txn_id=txn_id,
                refund=refund_entry,
            )
            return {"handled": "subscription_payment_refund_recorded", "txn_id": txn_id}

        # "Panic" type behavior if no sale is found
        return {
            "handled": "subscription_payment_refund_no_payment_doc",
            "txn_id": txn_id,
        }

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
