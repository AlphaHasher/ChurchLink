from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import HTTPException, Request, status
from pydantic import BaseModel, Field
from pymongo import DESCENDING

from mongo.database import DB

from bson import ObjectId

TxnKind = Literal[
    "donation_one_time",
    "donation_subscription",
    "donation_subscription_payment",
    "event",
    "form",
]
SortMode = Literal["created_desc", "created_asc"]


class BaseTransactionSearch(BaseModel):
    """
    Common search body for both user + admin queries.
    All fields are optional filters; undefined == don't filter on it.
    """
    kinds: List[TxnKind] = Field(
        default_factory=lambda: [
            "donation_one_time",
            "donation_subscription",
            "donation_subscription_payment",  # include plan payments by default
            "event",
            "form",
        ]
    )

    # Basic filters
    statuses: Optional[List[str]] = None

    paypal_order_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None
    paypal_subscription_id: Optional[str] = None

    created_from: Optional[datetime] = None
    created_to: Optional[datetime] = None

    # Pagination
    page: int = Field(1, ge=1)
    page_size: int = Field(25, ge=1, le=200)

    # Sorting
    sort: SortMode = "created_desc"

    # Debug / power-user knob: include the entire raw document
    include_raw: bool = False


class AdminTransactionSearch(BaseTransactionSearch):
    """
    Extensions only admins can use.
    """
    user_uid: Optional[str] = None  # search by owning user
    event_id: Optional[str] = None
    event_instance_id: Optional[str] = None
    form_id: Optional[str] = None


class UnifiedTransaction(BaseModel):
    """
    Normalized view across the four ledgers.
    Enough info for a generic admin/user UI.
    """
    id: str
    kind: TxnKind

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    status: Optional[str] = None

    # Original charged amount and currency (gross)
    amount: Optional[float] = None
    currency: Optional[str] = None

    # NEW: more detailed money breakdown (mainly for admin)
    # - gross_amount: synonym of amount, for clarity
    # - fee_amount: PayPal / processor fee at the txn level (if known)
    # - net_amount_before_refunds: gross_amount - fee_amount
    gross_amount: Optional[float] = None
    fee_amount: Optional[float] = None
    net_amount_before_refunds: Optional[float] = None

    # Refund aggregates
    # - refunded_total: total refunded across all entries (if any)
    # - net_amount: net AFTER refunds (using net_before_refunds if available)
    refunded_total: Optional[float] = None
    net_amount: Optional[float] = None

    # Flat list of refund entries (intentionally simple)
    refunds: List[Dict[str, Any]] = Field(default_factory=list)

    # Owning user (semantics vary slightly per ledger)
    user_uid: Optional[str] = None

    # PayPal identifiers
    paypal_order_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None
    paypal_subscription_id: Optional[str] = None

    # Extra context
    source_collection: str
    extra: Dict[str, Any] = Field(default_factory=dict)

    # Optional full document
    raw: Optional[Dict[str, Any]] = None



# -------------------
# Utility helpers
# -------------------


def _apply_time_filter(query: Dict[str, Any], body: BaseTransactionSearch) -> None:
    if body.created_from or body.created_to:
        time_filter: Dict[str, Any] = {}
        if body.created_from:
            time_filter["$gte"] = body.created_from
        if body.created_to:
            time_filter["$lte"] = body.created_to
        query["created_at"] = time_filter


def _apply_status_filter(query: Dict[str, Any], body: BaseTransactionSearch) -> None:
    if body.statuses:
        query["status"] = {"$in": body.statuses}


def _sort_key_for_tx(tx: UnifiedTransaction) -> float:
    """
    Sort by created_at; handle naive vs aware datetimes by using timestamp().
    """
    if not tx.created_at:
        return 0.0
    return tx.created_at.timestamp()

def _summarize_refunds(
    raw_refunds: Any,
    *,
    default_currency: str,
) -> tuple[List[Dict[str, Any]], float]:
    """
    Turn whatever is stored in doc['refunds'] into a flat list suitable
    for UnifiedTransaction.refunds and compute the refunded_total.
    """
    refunds: List[Dict[str, Any]] = []
    total = 0.0

    if not raw_refunds:
        return refunds, 0.0

    if not isinstance(raw_refunds, list):
        raw_refunds = [raw_refunds]

    for r in raw_refunds:
        if not isinstance(r, dict):
            continue

        amount_val = r.get("amount", 0.0)
        try:
            amt = float(amount_val)
        except (TypeError, ValueError):
            amt = 0.0

        total += amt

        refunds.append(
            {
                "refund_id": r.get("refund_id") or r.get("id"),
                "amount": amt,
                "currency": r.get("currency") or default_currency,
                "reason": r.get("reason"),
                "created_at": r.get("created_at") or r.get("at"),
                "by_uid": r.get("by_uid"),
                "source": r.get("source"),
            }
        )

    return refunds, round(total, 2)


def _map_donation_doc(
    doc: Dict[str, Any],
    *,
    include_raw: bool,
) -> UnifiedTransaction:
    amount = float(doc.get("amount", 0.0))
    currency = doc.get("currency", "USD")

    # New: processor breakdown
    def _flt(v: Any) -> Optional[float]:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    gross = _flt(doc.get("gross_amount"))
    fee = _flt(doc.get("fee_amount"))
    net_before = _flt(doc.get("net_amount"))

    if gross is None:
        gross = amount
    if net_before is None:
        if gross is not None and fee is not None:
            net_before = round(gross - fee, 2)
        else:
            net_before = gross

    refunds_raw = doc.get("refunds") or []
    refunds, refunded_total = _summarize_refunds(refunds_raw, default_currency=currency)

    net_after: Optional[float] = None
    if net_before is not None and refunded_total > 0:
        net_after = round(net_before - refunded_total, 2)

    return UnifiedTransaction(
        id=str(doc.get("_id")),
        kind="donation_one_time",
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        status=doc.get("status"),
        amount=amount,
        currency=currency,
        gross_amount=gross,
        fee_amount=fee,
        net_amount_before_refunds=net_before,
        refunded_total=refunded_total or None,
        net_amount=net_after if net_after is not None else None,
        refunds=refunds,
        user_uid=str(doc.get("donor_uid")) if doc.get("donor_uid") is not None else None,
        paypal_order_id=doc.get("paypal_order_id"),
        paypal_capture_id=doc.get("paypal_capture_id"),
        paypal_subscription_id=None,
        source_collection="donation_transactions",
        extra={
            "message": doc.get("message"),
            "meta": doc.get("meta") or {},
        },
        raw=doc if include_raw else None,
    )


def _map_donation_sub_doc(
    doc: Dict[str, Any],
    *,
    include_raw: bool,
) -> UnifiedTransaction:
    return UnifiedTransaction(
        id=str(doc.get("_id")),
        kind="donation_subscription",
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        status=doc.get("status"),
        amount=float(doc.get("amount", 0.0)),
        currency=doc.get("currency", "USD"),
        user_uid=doc.get("donor_uid"),
        paypal_order_id=None,
        paypal_capture_id=None,
        paypal_subscription_id=doc.get("paypal_subscription_id"),
        source_collection="donation_subscriptions",
        extra={
            "interval": doc.get("interval"),
            "message": doc.get("message"),
            "meta": doc.get("meta") or {},
        },
        raw=doc if include_raw else None,
    )


def _map_donation_sub_payment_doc(
    doc: Dict[str, Any],
    *,
    include_raw: bool,
) -> UnifiedTransaction:
    donor_uid = doc.get("donor_uid")
    status = doc.get("status") or "COMPLETED"
    created_at = doc.get("created_at")

    amount = float(doc.get("amount", 0.0))
    currency = doc.get("currency", "USD")

    def _flt(v: Any) -> Optional[float]:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    gross = _flt(doc.get("gross_amount"))
    fee = _flt(doc.get("fee_amount"))
    net_before = _flt(doc.get("net_amount"))

    if gross is None:
        gross = amount
    if net_before is None:
        if gross is not None and fee is not None:
            net_before = round(gross - fee, 2)
        else:
            net_before = gross

    refunds_raw = doc.get("refunds") or []
    refunds, refunded_total = _summarize_refunds(refunds_raw, default_currency=currency)

    # Legacy `refunded` boolean
    if not refunds and doc.get("refunded") and not refunded_total:
        refunded_total = amount
        refunds = [
            {
                "refund_id": "legacy:boolean_flag",
                "amount": refunded_total,
                "currency": currency,
                "reason": "legacy_refunded_flag",
                "created_at": doc.get("refunded_at"),
                "by_uid": None,
                "source": "legacy",
            }
        ]

    net_after: Optional[float] = None
    if net_before is not None and refunded_total > 0:
        net_after = round(net_before - refunded_total, 2)

    return UnifiedTransaction(
        id=str(doc.get("_id")),
        kind="donation_subscription_payment",
        created_at=created_at,
        updated_at=doc.get("updated_at") or created_at,
        status=status,
        amount=amount,
        currency=currency,
        gross_amount=gross,
        fee_amount=fee,
        net_amount_before_refunds=net_before,
        refunded_total=refunded_total or None,
        net_amount=net_after if net_after is not None else None,
        refunds=refunds,
        user_uid=str(donor_uid) if donor_uid else None,
        paypal_order_id=None,  # subscription payments usually use sale / capture id only
        paypal_capture_id=doc.get("paypal_txn_id"),
        paypal_subscription_id=doc.get("paypal_subscription_id"),
        source_collection="donation_subscription_payments",
        extra={
            "subscription_id": doc.get("paypal_subscription_id"),
            "meta": {},
        },
        raw=doc if include_raw else None,
    )


def _map_event_doc(
    doc: Dict[str, Any],
    *,
    include_raw: bool,
) -> UnifiedTransaction:
    items = doc.get("items") or []
    capture_id = None
    for it in items:
        if it.get("capture_id"):
            capture_id = it.get("capture_id")
            break

    line_items: List[Dict[str, Any]] = []
    flattened_refunds: List[Dict[str, Any]] = []
    currency = doc.get("currency", "USD")

    for idx, it in enumerate(items):
        refunds_raw = it.get("refunds") or []
        line_refunds_simple, line_refunded_total = _summarize_refunds(
            refunds_raw,
            default_currency=currency,
        )

        # Robust fallback for display name
        display_name = it.get("display_name") or it.get("person_display_name")
        if not display_name:
            pid = it.get("person_id")
            if pid == "SELF":
                display_name = "Self"
            elif isinstance(pid, str) and pid:
                display_name = f"Family member ({pid})"
            else:
                display_name = f"Line #{idx + 1}"

        if line_refunds_simple:
            for simple in line_refunds_simple:
                flattened_refunds.append(
                    {
                        **simple,
                        "line_id": it.get("line_id"),
                        "person_id": it.get("person_id"),
                        "person_display_name": display_name,
                    }
                )

        line_items.append(
            {
                "line_id": it.get("line_id"),
                "person_id": it.get("person_id"),
                "display_name": display_name,
                "unit_price": float(it.get("unit_price", 0.0)),
                "status": it.get("status"),
                "payment_type": it.get("payment_type"),
                "capture_id": it.get("capture_id"),
                "refunded_total": line_refunded_total,
                "refunds": line_refunds_simple,
            }
        )

    # Money summary
    amount = float(doc.get("total", 0.0))
    fee_amount = doc.get("fee_amount")
    fee_amount = float(fee_amount) if isinstance(fee_amount, (int, float, str)) and fee_amount is not None else None

    refunded_total = 0.0
    for li in line_items:
        refunded_total += float(li.get("refunded_total") or 0.0)
    refunded_total = round(refunded_total, 2)

    gross_amount = amount
    net_before = None
    if gross_amount is not None and fee_amount is not None:
        net_before = round(gross_amount - fee_amount, 2)

    # Net AFTER refunds – prefer net_before if available
    net_after = None
    if gross_amount is not None:
        base = net_before if net_before is not None else gross_amount
        if refunded_total > 0:
            net_after = round(base - refunded_total, 2)

    return UnifiedTransaction(
        id=str(doc.get("_id")),
        kind="event",
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        status=doc.get("status"),
        amount=gross_amount,
        currency=currency,
        gross_amount=gross_amount,
        fee_amount=fee_amount,
        net_amount_before_refunds=net_before,
        refunded_total=refunded_total or None,
        net_amount=net_after,
        refunds=flattened_refunds,
        user_uid=doc.get("payer_uid"),
        paypal_order_id=doc.get("order_id"),
        paypal_capture_id=capture_id,
        paypal_subscription_id=None,
        source_collection="event_transactions",
        extra={
            "event_id": doc.get("event_id"),
            "event_instance_id": doc.get("event_instance_id"),
            "items_count": len(items),
            "line_items": line_items,
            "meta": doc.get("meta") or {},
        },
        raw=doc if include_raw else None,
    )


def _map_form_doc(
    doc: Dict[str, Any],
    *,
    include_raw: bool,
) -> UnifiedTransaction:
    user_id = doc.get("user_id")

    amount = float(doc.get("amount", 0.0))
    currency = doc.get("currency", "USD")

    def _flt(v: Any) -> Optional[float]:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    gross = _flt(doc.get("gross_amount"))
    fee = _flt(doc.get("fee_amount"))
    net_before = _flt(doc.get("net_amount"))

    if gross is None:
        gross = amount
    if net_before is None:
        if gross is not None and fee is not None:
            net_before = round(gross - fee, 2)
        else:
            net_before = gross

    refunds_raw = doc.get("refunds") or []
    refunds, refunded_total = _summarize_refunds(refunds_raw, default_currency=currency)

    net_after: Optional[float] = None
    if net_before is not None and refunded_total > 0:
        net_after = round(net_before - refunded_total, 2)

    # ---- Sanitize form_id so it is JSON-serializable ----
    raw_form_id = doc.get("form_id")
    if isinstance(raw_form_id, ObjectId):
        form_id_str = str(raw_form_id)
    else:
        form_id_str = raw_form_id

    return UnifiedTransaction(
        id=str(doc.get("_id")),
        kind="form",
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        status=doc.get("status"),
        amount=amount,
        currency=currency,
        gross_amount=gross,
        fee_amount=fee,
        net_amount_before_refunds=net_before,
        refunded_total=refunded_total or None,
        net_amount=net_after if net_after is not None else None,
        refunds=refunds,
        user_uid=str(user_id) if user_id is not None else None,
        paypal_order_id=doc.get("paypal_order_id"),
        paypal_capture_id=doc.get("paypal_capture_id"),
        paypal_subscription_id=None,
        source_collection="form_transactions",
        extra={
            "form_id": form_id_str,
            "meta": doc.get("metadata") or {},
        },
        raw=doc if include_raw else None,
    )

def _apply_time_filter(query: Dict[str, Any], body: BaseTransactionSearch) -> None:
    if body.created_from or body.created_to:
        time_filter: Dict[str, Any] = {}
        if body.created_from:
            time_filter["$gte"] = body.created_from
        if body.created_to:
            time_filter["$lte"] = body.created_to
        query["created_at"] = time_filter


def _apply_status_filter(query: Dict[str, Any], body: BaseTransactionSearch) -> None:
    """
    Apply a raw status filter: body.statuses is a list of backend status values.

    Examples (per kind):
      - donation_one_time / form: ["captured"], ["failed"], ...
      - event: ["captured", "partially_refunded", "fully_refunded", ...]
      - donation_subscription: ["ACTIVE", "CANCELLED", ...]
      - donation_subscription_payment: ["COMPLETED"], ...
    """
    if body.statuses:
        query["status"] = {"$in": body.statuses}


def _sort_key_for_tx(tx: UnifiedTransaction) -> float:
    """
    Sort by created_at; handle naive vs aware datetimes by using timestamp().
    """
    if not tx.created_at:
        return 0.0
    return tx.created_at.timestamp()


def _normalize_uid_for_query(value: Optional[str]) -> Optional[Any]:
    """
    For user_uid / donor_uid filters, normalize to ObjectId if possible,
    otherwise leave as a plain string.

    This keeps things working whether the ledger stored:
      - donor_uid / user_id as ObjectId(...)
      - or as a raw string uid.
    """
    if value is None:
        return None
    try:
        if ObjectId.is_valid(value):
            return ObjectId(value)
    except Exception:
        # fall through to returning the raw string
        pass
    return value


def _determine_effective_kinds(
    *,
    body: BaseTransactionSearch,
    is_admin: bool,
    admin_extras: Optional[AdminTransactionSearch],
) -> List[TxnKind]:
    """
    Narrow which ledgers we even touch, based on kind-specific filters.

    Rules:
      - If event_id / event_instance_id is set (admin only), only "event" makes sense.
      - If form_id is set (admin only), only "form" makes sense.
      - If paypal_subscription_id is set, only subscription plan + payments make sense.
      - If paypal_order_id is set, only order-based ledgers make sense (donation/form/event).
      - If paypal_capture_id is set, only capture/txn-based ledgers make sense
        (donation/form/event + subscription payments).
      - Otherwise, use whatever the caller provided in body.kinds (or defaults).
    """
    # start with requested kinds or default if somehow empty
    base: List[TxnKind] = body.kinds or [
        "donation_one_time",
        "donation_subscription",
        "donation_subscription_payment",
        "event",
        "form",
    ]
    effective_set = set(base)

    if is_admin and admin_extras:
        # event-scoped filters → only event transactions
        if admin_extras.event_id or admin_extras.event_instance_id:
            effective_set &= {"event"}

        # form-scoped filters → only form transactions
        if admin_extras.form_id:
            effective_set &= {"form"}

    # subscription id only makes sense for plans + plan payments
    if body.paypal_subscription_id:
        effective_set &= {"donation_subscription", "donation_subscription_payment"}

    # order id is only meaningful for donation/form/event ledgers
    if body.paypal_order_id:
        effective_set &= {"donation_one_time", "event", "form"}

    # capture id:
    # - donation/form use paypal_capture_id directly
    # - event uses items.capture_id
    # - subscription payments use paypal_txn_id but we map capture filter to it
    if body.paypal_capture_id:
        effective_set &= {
            "donation_one_time",
            "event",
            "form",
            "donation_subscription_payment",
        }

    # preserve original order of base while filtering by the set
    return [k for k in base if k in effective_set]



async def _query_transactions_common(
    *,
    body: BaseTransactionSearch,
    uid: Optional[str],
    is_admin: bool,
    admin_extras: Optional[AdminTransactionSearch] = None,
) -> Dict[str, Any]:
    """
    Shared query logic for both /transactions/my and /admin-transactions/search.

    Behavior notes:

      - All filters are ANDed together (within a kind).
      - If a filter conceptually only applies to a specific kind
        (e.g. event_id → events; form_id → forms; paypal_subscription_id → plans/payments),
        we narrow which collections we even touch via _determine_effective_kinds.

      - Text-ish fields (order id, capture id, subscription id, event/form ids) use
        case-insensitive "contains" matching via $regex.
      - statuses: List[str] is passed straight through to Mongo as an $in filter; the
        caller is responsible for providing raw backend values per kind.
    """
    if not is_admin and not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    effective_kinds = _determine_effective_kinds(
        body=body, is_admin=is_admin, admin_extras=admin_extras
    )

    # We'll slightly overfetch per-kind and then sort+page in memory.
    per_kind_limit = body.page_size * 3
    unified: List[UnifiedTransaction] = []

    # ------------------------
    # Donations (one-time)
    # ------------------------
    if "donation_one_time" in effective_kinds:
        q: Dict[str, Any] = {}

        if not is_admin:
            # my own donations
            q["donor_uid"] = _normalize_uid_for_query(uid)
        elif admin_extras and admin_extras.user_uid:
            q["donor_uid"] = _normalize_uid_for_query(admin_extras.user_uid)

        # PayPal ids: allow partial, case-insensitive
        if body.paypal_order_id:
            q["paypal_order_id"] = {
                "$regex": body.paypal_order_id,
                "$options": "i",
            }
        if body.paypal_capture_id:
            q["paypal_capture_id"] = {
                "$regex": body.paypal_capture_id,
                "$options": "i",
            }

        _apply_status_filter(q, body)
        _apply_time_filter(q, body)

        cursor = (
            DB.db["donation_transactions"]
            .find(q)
            .sort("created_at", DESCENDING)
            .limit(per_kind_limit)
        )
        async for doc in cursor:
            unified.append(_map_donation_doc(doc, include_raw=body.include_raw))

    # ------------------------
    # Donation subscription plans
    # ------------------------
    if "donation_subscription" in effective_kinds:
        q = {}
        if not is_admin:
            q["donor_uid"] = _normalize_uid_for_query(uid)
        elif admin_extras and admin_extras.user_uid:
            q["donor_uid"] = _normalize_uid_for_query(admin_extras.user_uid)

        if body.paypal_subscription_id:
            q["paypal_subscription_id"] = {
                "$regex": body.paypal_subscription_id,
                "$options": "i",
            }

        _apply_status_filter(q, body)
        _apply_time_filter(q, body)

        cursor = (
            DB.db["donation_subscriptions"]
            .find(q)
            .sort("created_at", DESCENDING)
            .limit(per_kind_limit)
        )
        async for doc in cursor:
            unified.append(_map_donation_sub_doc(doc, include_raw=body.include_raw))

    # ------------------------
    # Donation subscription plan payments
    # ------------------------
    if "donation_subscription_payment" in effective_kinds:
        q = {}
        if not is_admin:
            q["donor_uid"] = _normalize_uid_for_query(uid)
        elif admin_extras and admin_extras.user_uid:
            q["donor_uid"] = _normalize_uid_for_query(admin_extras.user_uid)

        # subscription-level filter (partial, case-insensitive)
        if body.paypal_subscription_id:
            q["paypal_subscription_id"] = {
                "$regex": body.paypal_subscription_id,
                "$options": "i",
            }

        # capture/txn id filter – payments store paypal_txn_id
        if body.paypal_capture_id:
            q["paypal_txn_id"] = {
                "$regex": body.paypal_capture_id,
                "$options": "i",
            }

        _apply_status_filter(q, body)
        _apply_time_filter(q, body)

        cursor = (
            DB.db["donation_subscription_payments"]
            .find(q)
            .sort("created_at", DESCENDING)
            .limit(per_kind_limit)
        )
        async for doc in cursor:
            unified.append(
                _map_donation_sub_payment_doc(doc, include_raw=body.include_raw)
            )

    # ------------------------
    # Events
    # ------------------------
    if "event" in effective_kinds:
        q = {}

        if not is_admin:
            q["payer_uid"] = uid
        elif admin_extras and admin_extras.user_uid:
            # event payer_uid is stored as a string; safe to use regex for partial match
            q["payer_uid"] = {
                "$regex": admin_extras.user_uid,
                "$options": "i",
            }

        if body.paypal_order_id:
            q["order_id"] = {
                "$regex": body.paypal_order_id,
                "$options": "i",
            }
        if body.paypal_capture_id:
            # Capture id is stored per item; this is a coarse filter but works.
            q["items.capture_id"] = {
                "$regex": body.paypal_capture_id,
                "$options": "i",
            }

        if admin_extras:
            if admin_extras.event_id:
                q["event_id"] = {
                    "$regex": admin_extras.event_id,
                    "$options": "i",
                }
            if admin_extras.event_instance_id:
                q["event_instance_id"] = {
                    "$regex": admin_extras.event_instance_id,
                    "$options": "i",
                }

        _apply_status_filter(q, body)
        _apply_time_filter(q, body)

        cursor = (
            DB.db["event_transactions"]
            .find(q)
            .sort("created_at", DESCENDING)
            .limit(per_kind_limit)
        )
        async for doc in cursor:
            unified.append(_map_event_doc(doc, include_raw=body.include_raw))

    # ------------------------
    # Forms
    # ------------------------
    if "form" in effective_kinds:
        q = {}
        if not is_admin:
            q["user_id"] = uid
        elif admin_extras and admin_extras.user_uid:
            # form user_id is stored as string; regex is safe
            q["user_id"] = {
                "$regex": admin_extras.user_uid,
                "$options": "i",
            }

        if body.paypal_order_id:
            q["paypal_order_id"] = {
                "$regex": body.paypal_order_id,
                "$options": "i",
            }
        if body.paypal_capture_id:
            q["paypal_capture_id"] = {
                "$regex": body.paypal_capture_id,
                "$options": "i",
            }

        if admin_extras and admin_extras.form_id:
            q["form_id"] = {
                "$regex": admin_extras.form_id,
                "$options": "i",
            }

        _apply_status_filter(q, body)
        _apply_time_filter(q, body)

        cursor = (
            DB.db["form_transactions"]
            .find(q)
            .sort("created_at", DESCENDING)
            .limit(per_kind_limit)
        )
        async for doc in cursor:
            unified.append(_map_form_doc(doc, include_raw=body.include_raw))

    # ------------------------
    # Global sort + pagination
    # ------------------------
    reverse = body.sort == "created_desc"
    unified.sort(key=_sort_key_for_tx, reverse=reverse)

    start = (body.page - 1) * body.page_size
    end = start + body.page_size
    page_items = unified[start:end]
    has_more = len(unified) > end


    return {
        "items": [tx.model_dump(exclude_none=True) for tx in page_items],
        "page": body.page,
        "page_size": body.page_size,
        "has_more": has_more,
        "next_page": body.page + 1 if has_more else None,
        # Optional debugging: counts per kind
        "counts": {
            "total_fetched": len(unified),
        },
    }


# -------------------
# Public controller functions
# -------------------


async def list_my_transactions(
    request: Request,
    body: BaseTransactionSearch,
) -> Dict[str, Any]:
    uid = getattr(request.state, "uid", None)
    return await _query_transactions_common(
        body=body,
        uid=uid,
        is_admin=False,
        admin_extras=None,
    )


async def admin_search_transactions(
    request: Request,
    body: AdminTransactionSearch,
) -> Dict[str, Any]:
    # At this layer we assume the router already enforced admin permissions.
    uid = getattr(request.state, "uid", None)
    return await _query_transactions_common(
        body=body,
        uid=uid,
        is_admin=True,
        admin_extras=body,
    )
