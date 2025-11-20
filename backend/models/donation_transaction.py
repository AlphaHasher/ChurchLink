from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Literal, Any, Dict, List

from bson import ObjectId
from pydantic import BaseModel, Field

from mongo.database import DB
from models.refund_models import TransactionRefund
import logging

"""
A lightweight ledger for one-time donations captured via PayPal Orders v2.

Lifecycle:
- "created": PayPal order created (no funds captured)
- "captured": PayPal order captured (we store the capture id)
- "partially_refunded": some amount refunded, but not all
- "fully_refunded": total refunded amount >= original amount
- "failed": error during capture/creation
"""

DonationTxnStatus = Literal[
    "created",
    "captured",
    "partially_refunded",
    "fully_refunded",
    "failed",
]


class DonationTransaction(BaseModel):
    id: Optional[Any] = Field(default=None, alias="_id")
    status: DonationTxnStatus = "created"

    # PayPal ids
    paypal_order_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None

    # Who gave + who will be able to refund later
    donor_uid: Optional[str] = None          # user uid if authenticated; optional for anonymous

    # Legacy money fields.
    # Historically this is "what we charged". We'll keep it for now even once gross/fee/net exist.
    amount: float
    currency: Literal["USD"] = "USD"

    # Detailed PayPal amounts; populated from capture payloads going forward.
    # For older documents these may be null.
    # - gross_amount: what the donor actually paid for this transaction
    # - fee_amount: processor fees taken out (PayPal fees)
    # - net_amount: gross_amount - fee_amount (what we actually receive before refunds)
    gross_amount: Optional[float] = None
    fee_amount: Optional[float] = None
    net_amount: Optional[float] = None

    # Refund log (append-only)
    refunds: List[TransactionRefund] = Field(default_factory=list)

    # Optional context
    message: Optional[str] = None            # donor-supplied message
    meta: Dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo(self) -> Dict[str, Any]:
        return self.dict(by_alias=True, exclude_none=True)
    
def _extract_amounts_and_fees_from_capture_payload(
    capture_payload: dict | None,
) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Best-effort extraction of (gross, fee, net) from a direct capture payload.

    Handles either:
    - A capture object with seller_receivable_breakdown, or
    - A full order object with purchase_units[0].payments.captures[0].
    """
    gross: Optional[float] = None
    fee: Optional[float] = None
    net: Optional[float] = None

    if not capture_payload:
        return gross, fee, net

    payload = capture_payload or {}
    r = payload

    # If this looks like an order (has purchase_units), drill into the first capture.
    if "seller_receivable_breakdown" not in r:
        purchase_units = payload.get("purchase_units") or []
        if purchase_units:
            payments = (purchase_units[0].get("payments") or {})
            captures = payments.get("captures") or []
            if captures:
                r = captures[0]

    srb = r.get("seller_receivable_breakdown") or {}
    if srb:
        gross_amount = srb.get("gross_amount") or {}
        fee_amount = srb.get("paypal_fee") or srb.get("fee_amount") or {}
        net_amount = srb.get("net_amount") or {}

        v = gross_amount.get("value")
        if v is not None:
            gross = float(v)

        v = fee_amount.get("value")
        if v is not None:
            fee = float(v)

        v = net_amount.get("value")
        if v is not None:
            net = float(v)

    amount = r.get("amount") or {}
    v = amount.get("value", amount.get("total"))
    if v is not None and gross is None:
        gross = float(v)

    if gross is not None and net is None and fee is not None:
        net = round(gross - fee, 2)
    elif gross is not None and net is not None and fee is None:
        fee = round(gross - net, 2)

    return gross, fee, net


def _normalize_refunds(raw_list: Any) -> List[TransactionRefund]:
    """
    Tolerant parser for existing refund arrays.

    Handles:
    - Already-canonical TransactionRefund-shaped dicts.
    - Legacy entries from _mark_order_refund_everywhere:
      {paypal_refund_payload, amount, currency, at}
    """
    refunds: List[TransactionRefund] = []
    if not raw_list:
        return refunds

    for idx, raw in enumerate(raw_list):
        if isinstance(raw, TransactionRefund):
            refunds.append(raw)
            continue

        if not isinstance(raw, dict):
            continue

        try:
            refunds.append(TransactionRefund.parse_obj(raw))
            continue
        except Exception as e:
            logging.warning(f"Failed to parse refund entry at index {idx}: {e}")

        legacy_amount = float(raw.get("amount", 0.0) or 0.0)
        legacy_currency = (raw.get("currency") or "USD").upper()
        legacy_id = (
            raw.get("refund_id")
            or raw.get("id")
            or raw.get("paypal_refund_id")
            or f"legacy:{idx}"
        )

        refunds.append(
            TransactionRefund(
                refund_id=str(legacy_id),
                amount=legacy_amount,
                currency=legacy_currency,  # type: ignore[arg-type]
                created_at=raw.get("at") or datetime.now(timezone.utc),
                source="legacy_webhook",
                paypal_refund_payload=raw.get("paypal_refund_payload") or raw,
            )
        )

    return refunds


def _compute_refunded_total(refunds: List[TransactionRefund]) -> float:
    return round(sum((float(r.amount) for r in refunds), 0.0), 2)


def _derive_status_after_refund(
    *,
    original_amount: float,
    current_status: str,
    refunded_total: float,
) -> DonationTxnStatus:
    """
    Project refunded_total into a DonationTxnStatus.

    Only transitions captured/partially_refunded/fully_refunded; other states are left as-is.
    """
    if current_status not in {"captured", "partially_refunded", "fully_refunded"}:
        return current_status  # type: ignore[return-value]

    if refunded_total <= 0:
        return current_status  # type: ignore[return-value]

    epsilon = 0.01
    if refunded_total + epsilon >= original_amount:
        return "fully_refunded"

    return "partially_refunded"


async def create_donation_transaction(
    *,
    amount: float,
    currency: str = "USD",
    donor_uid: Optional[str],
    message: Optional[str] = None,
    paypal_order_id: Optional[str] = None,
    meta: Optional[dict] = None,
) -> dict:
    doc = {
        "status": "created",
        "amount": float(amount),
        "currency": currency,
        "donor_uid": ObjectId(donor_uid) if donor_uid and ObjectId.is_valid(donor_uid) else donor_uid,
        "message": message,
        "paypal_order_id": paypal_order_id,
        "paypal_capture_id": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "meta": meta or {},
        "refunds": [],
    }
    res = await DB.db.donation_transactions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def mark_donation_captured(
    *,
    paypal_order_id: str,
    capture_id: str,
    capture_payload: dict | None = None,
) -> Optional[dict]:
    gross, fee, net = _extract_amounts_and_fees_from_capture_payload(capture_payload)

    set_fields: Dict[str, Any] = {
        "status": "captured",
        "paypal_capture_id": capture_id,
        "capture_payload": capture_payload or {},
        "updated_at": datetime.now(timezone.utc),
    }
    if gross is not None:
        set_fields["gross_amount"] = float(gross)
    if fee is not None:
        set_fields["fee_amount"] = float(fee)
    if net is not None:
        set_fields["net_amount"] = float(net)

    update = {"$set": set_fields}

    return await DB.db.donation_transactions.find_one_and_update(
        {"paypal_order_id": paypal_order_id},
        update,
        return_document=True,
    )

async def mark_donation_failed(
    *, paypal_order_id: Optional[str], reason: str, payload: dict | None = None
) -> Optional[dict]:
    if not paypal_order_id:
        return None
    q = {"paypal_order_id": paypal_order_id}
    update = {
        "$set": {
            "status": "failed",
            "fail_reason": reason,
            "failure_payload": payload or {},
            "updated_at": datetime.now(timezone.utc),
        }
    }
    return await DB.db.donation_transactions.find_one_and_update(q, update, return_document=True)


async def record_donation_refund(
    *,
    paypal_capture_id: str,
    refund: TransactionRefund,
) -> Optional[dict]:
    """
    Append a refund entry and adjust status based on refunded_total.

    Idempotent per refund_id: if a refund with the same refund_id already exists,
    no new entry is added but status/updated_at are still refreshed.
    """
    capture_id = (paypal_capture_id or "").strip()
    if not capture_id:
        return None

    doc = await DB.db.donation_transactions.find_one({"paypal_capture_id": capture_id})
    if not doc:
        return None

    existing_refunds = _normalize_refunds(doc.get("refunds") or [])
    if refund.refund_id and any(r.refund_id == refund.refund_id for r in existing_refunds):
        refunds = existing_refunds
    else:
        refunds = existing_refunds + [refund]

    refunded_total = _compute_refunded_total(refunds)
    original_amount = float(doc.get("amount", 0.0) or 0.0)
    current_status = doc.get("status") or "created"

    new_status = _derive_status_after_refund(
        original_amount=original_amount,
        current_status=str(current_status),
        refunded_total=refunded_total,
    )

    update = {
        "$set": {
            "refunds": [r.dict(by_alias=True, exclude_none=True) for r in refunds],
            "status": new_status,
            "updated_at": datetime.now(timezone.utc),
        }
    }

    return await DB.db.donation_transactions.find_one_and_update(
        {"_id": doc["_id"]},
        update,
        return_document=True,
    )


async def get_donation_transaction_by_order_id(paypal_order_id: str) -> Optional[dict]:
    return await DB.db.donation_transactions.find_one({"paypal_order_id": paypal_order_id})
