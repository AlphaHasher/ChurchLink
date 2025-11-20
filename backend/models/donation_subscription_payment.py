from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from mongo.database import DB
from models.refund_models import TransactionRefund


def _normalize_refunds(raw_list: Any) -> List[TransactionRefund]:
    """
    Tolerant parser for refund arrays on donation_subscription_payments.

    Handles:
    - Canonical TransactionRefund-shaped dicts.
    - Any ad-hoc dict with {amount, currency, ...}.
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
        except Exception:
            pass

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
                created_at=raw.get("created_at") or datetime.now(timezone.utc),
                source="legacy",
                paypal_refund_payload=raw,
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
) -> str:
    """
    Subscription payment statuses are historically PayPal-style
    (e.g. 'COMPLETED'); we introduce PARTIALLY_REFUNDED/FULLY_REFUNDED
    and otherwise leave unknown statuses unchanged.
    """
    normalized = (current_status or "").upper()
    refundable_states = {"COMPLETED", "PARTIALLY_REFUNDED", "FULLY_REFUNDED"}
    if normalized not in refundable_states:
        return current_status

    if refunded_total <= 0:
        return current_status

    epsilon = 0.01
    if refunded_total + epsilon >= original_amount:
        return "FULLY_REFUNDED"

    return "PARTIALLY_REFUNDED"


async def record_subscription_payment_refund(
    *,
    paypal_txn_id: str,
    refund: TransactionRefund,
) -> Optional[Dict[str, Any]]:
    """
    Append a refund entry for a subscription payment and adjust its status.

    Idempotent per refund_id. Leaves legacy `refunded` boolean in place for now;
    later phases can choose to keep or drop it.
    """
    sale_id = (paypal_txn_id or "").strip()
    if not sale_id:
        return None

    doc = await DB.db.donation_subscription_payments.find_one({"paypal_txn_id": sale_id})
    if not doc:
        return None

    existing_refunds = _normalize_refunds(doc.get("refunds") or [])
    if refund.refund_id and any(r.refund_id == refund.refund_id for r in existing_refunds):
        refunds = existing_refunds
    else:
        refunds = existing_refunds + [refund]

    refunded_total = _compute_refunded_total(refunds)
    original_amount = float(doc.get("amount", 0.0) or 0.0)
    current_status = doc.get("status") or "COMPLETED"

    new_status = _derive_status_after_refund(
        original_amount=original_amount,
        current_status=str(current_status),
        refunded_total=refunded_total,
    )

    update: Dict[str, Any] = {
        "$set": {
            "refunds": [r.dict(by_alias=True, exclude_none=True) for r in refunds],
            "status": new_status,
            "updated_at": datetime.now(timezone.utc),
        }
    }

    # For now we keep `refunded` boolean as a convenience for fully-refunded rows.
    if new_status == "FULLY_REFUNDED":
        update["$set"]["refunded"] = True
        update["$set"]["refunded_at"] = datetime.now(timezone.utc)

    return await DB.db.donation_subscription_payments.find_one_and_update(
        {"_id": doc["_id"]},
        update,
        return_document=True,
    )


async def find_subscription_payments_for_user(
    *,
    donor_uid: str,
    created_from: Optional[datetime] = None,
    created_to: Optional[datetime] = None,
    paypal_subscription_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {"donor_uid": donor_uid}

    if created_from is not None or created_to is not None:
        q["created_at"] = {}
        if created_from is not None:
            q["created_at"]["$gte"] = created_from
        if created_to is not None:
            q["created_at"]["$lte"] = created_to

    if paypal_subscription_id:
        q["paypal_subscription_id"] = paypal_subscription_id

    cursor = DB.db["donation_subscription_payments"].find(q).sort("created_at", -1)
    return [doc async for doc in cursor]
