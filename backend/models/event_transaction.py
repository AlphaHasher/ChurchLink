from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Tuple
from datetime import datetime, timezone

from pydantic import BaseModel, Field, validator

from mongo.database import DB
from pymongo import ASCENDING, DESCENDING, ReturnDocument


# ----------------------------
# Collection handle & indexes
# ----------------------------

# TODO: THIS NEVER GETS CALLED, THIS IS TO BE MOVED TO MONGO.DB LATER ON WITH A GRAND INDEX CREATION THING

async def ensure_event_transactions_indexes() -> None:
    """
    Call this once during startup (next to other ensure_*_indexes) to keep queries snappy.
    """
    await DB.db["event_transactions"].create_index([("order_id", ASCENDING)], unique=True, name="uniq_order_id")
    await DB.db["event_transactions"].create_index([("payer_uid", ASCENDING), ("created_at", DESCENDING)], name="by_payer_time")
    await DB.db["event_transactions"].create_index([("event_instance_id", ASCENDING), ("created_at", DESCENDING)], name="by_instance_time")
    await DB.db["event_transactions"].create_index([("event_id", ASCENDING), ("created_at", DESCENDING)], name="by_event_time")
    await DB.db["event_transactions"].create_index([("status", ASCENDING), ("created_at", DESCENDING)], name="by_status_time")
    # These two help idempotency checks / quick lookups for refunds & captures
    await DB.db["event_transactions"].create_index([("items.capture_id", ASCENDING)], sparse=True, name="item_capture_id")
    await DB.db["event_transactions"].create_index([("items.refunds.refund_id", ASCENDING)], sparse=True, name="item_refund_id")


# ----------------------------
# Pydantic models (ledger)
# ----------------------------

LineStatus = Literal["pending", "captured", "refunded", "failed"]
TxnStatus = Literal[
    "created", "approved", "captured", "partially_refunded", "fully_refunded", "voided", "failed"
]
PaymentType = Literal["paypal", "door", "free"]


class TransactionRefund(BaseModel):
    refund_id: str  # PayPal refund id
    amount: float
    reason: Optional[str] = None            # "admin_initiated" | "automatic_refund" | etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    by_uid: Optional[str] = None            # admin uid if applicable


class TransactionItem(BaseModel):
    line_id: str                             # our stable per-person line identifier
    person_id: str                           # "SELF" or family member id
    display_name: str                        # snapshot for human audit
    unit_price: float                        # should match PayPal line price
    payment_type: PaymentType = "paypal"     # mirrors PaymentDetails.payment_type
    capture_id: Optional[str] = None         # PayPal capture id after capture
    status: LineStatus = "pending"
    refunds: List[TransactionRefund] = Field(default_factory=list)

    @property
    def refunded_total(self) -> float:
        return sum((r.amount for r in self.refunds), 0.0)


class RawSnapshots(BaseModel):
    order_create_payload: Optional[Dict[str, Any]] = None
    order_create_response: Optional[Dict[str, Any]] = None
    capture_response: Optional[Dict[str, Any]] = None


class EventTransaction(BaseModel):
    # Mongo ObjectId lives under `_id` but we always expose/accept string ids elsewhere via accessors if needed.
    id: Optional[Any] = Field(default=None, alias="_id")

    # PayPal order id
    order_id: str
    status: TxnStatus = "created"

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    payer_uid: str
    event_instance_id: str
    event_id: str

    total: float
    currency: Literal["USD"] = "USD"

    items: List[TransactionItem] = Field(default_factory=list)

    # Snapshots for audit / reconciliation. Safe to trim later if size matters.
    raw: RawSnapshots = Field(default_factory=RawSnapshots)

    # Freeform bag for future flags; intentionally kept generic
    meta: Dict[str, Any] = Field(default_factory=dict)

    @validator("total")
    def _guard_total(cls, v: float) -> float:
        return round(float(v), 2)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert to a Mongo-friendly dict (preserving _id if present)."""
        data = self.dict(by_alias=True, exclude_none=True)
        return data

    def recompute_totals(self) -> None:
        """Keep 'total' consistent with sum of line unit prices (useful on rebuild)."""
        self.total = round(sum((it.unit_price for it in self.items), 0.0), 2)

    def derive_overall_status(self) -> TxnStatus:
        """
        Project line statuses to a transaction-level status once captured:
        - All captured -> 'captured'
        - Some refunded -> 'partially_refunded' or 'fully_refunded'
        """
        if not self.items:
            return self.status

        statuses = {it.status for it in self.items}
        if statuses == {"captured"}:
            return "captured"
        if statuses.issubset({"captured", "refunded"}):
            # fully refunded if all non-zero-priced items are refunded by amount
            all_ref = all(
                (it.status == "refunded") or (round(it.refunded_total, 2) >= round(it.unit_price, 2))
                for it in self.items
            )
            return "fully_refunded" if all_ref else "partially_refunded"
        if "failed" in statuses and statuses <= {"failed", "pending"}:
            return "failed"
        return self.status


# ----------------------------
# CRUD helpers (async)
# ----------------------------

async def create_preliminary_transaction(
    *,
    order_id: str,
    payer_uid: str,
    event_instance_id: str,
    event_id: str,
    currency: Literal["USD"],
    items: List[TransactionItem],
    raw_order_create_payload: Optional[Dict[str, Any]] = None,
    raw_order_create_response: Optional[Dict[str, Any]] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> EventTransaction:
    """
    Create a new 'created' transaction before redirecting the user to PayPal approve URL.
    Idempotent on order_id.
    """
    now = datetime.now(timezone.utc)
    tx = EventTransaction(
        order_id=order_id,
        status="created",
        created_at=now,
        updated_at=now,
        payer_uid=payer_uid,
        event_instance_id=event_instance_id,
        event_id=event_id,
        total=round(sum((it.unit_price for it in items), 0.0), 2),
        currency=currency,
        items=items,
        raw=RawSnapshots(
            order_create_payload=raw_order_create_payload,
            order_create_response=raw_order_create_response,
        ),
        meta=meta or {},
    )

    # Idempotency: upsert by order_id (don't duplicate if retried)
    existing = await DB.db["event_transactions"].find_one({"order_id": order_id})
    if existing:
        return EventTransaction.parse_obj(existing)

    res = await DB.db["event_transactions"].insert_one(tx.to_mongo())
    created = await DB.db["event_transactions"].find_one({"_id": res.inserted_id})
    return EventTransaction.parse_obj(created)


async def mark_transaction_approved(order_id: str) -> Optional[EventTransaction]:
    """
    Optional step: if you capture via return_url after APPROVE, you can mark it.
    """
    doc = await DB.db["event_transactions"].find_one_and_update(
        {"order_id": order_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    return EventTransaction.parse_obj(doc) if doc else None


async def mark_transaction_captured(
    *,
    order_id: str,
    capture_response: Dict[str, Any],
    # (capture mapping) list of (line_id, capture_id, new_status)
    captured_lines: List[Tuple[str, str, LineStatus]],
) -> Optional[EventTransaction]:
    """
    After PayPal capture succeeds:
      - write capture_response
      - set capture_id & status on specified lines
      - update top-level status based on line statuses
    """
    now = datetime.now(timezone.utc)

    # Build updates for line items
    tx = await DB.db["event_transactions"].find_one({"order_id": order_id})
    if not tx:
        return None

    parsed = EventTransaction.parse_obj(tx)
    line_map = {it.line_id: it for it in parsed.items}

    for lid, cap_id, new_status in captured_lines:
        if lid in line_map:
            it = line_map[lid]
            it.capture_id = cap_id
            it.status = new_status

    # derive top-level status
    parsed.status = parsed.derive_overall_status()
    parsed.updated_at = now
    # attach raw capture snapshot
    parsed.raw.capture_response = capture_response

    doc = await DB.db["event_transactions"].find_one_and_replace(
        {"_id": tx["_id"]},
        parsed.to_mongo(),
        return_document=ReturnDocument.AFTER,
    )
    return EventTransaction.parse_obj(doc) if doc else None


async def append_refund_to_item(
    *,
    order_id: str,
    line_id: str,
    refund_id: str,
    amount: float,
    reason: Optional[str],
    by_uid: Optional[str],
) -> Optional[EventTransaction]:
    """
    Append a refund record to a specific line and update line/txn statuses accordingly.
    """
    tx = await DB.db["event_transactions"].find_one({"order_id": order_id})
    if not tx:
        return None

    parsed = EventTransaction.parse_obj(tx)
    # idempotency: if refund_id already recorded, just return
    if any(refund_id == r.refund_id for it in parsed.items for r in it.refunds):
        return parsed

    # attach refund to the matched line
    target = next((it for it in parsed.items if it.line_id == line_id), None)
    if not target:
        return parsed  # line not found; no-op to avoid corruption

    refund = TransactionRefund(
        refund_id=refund_id, amount=round(amount, 2), reason=reason, by_uid=by_uid
    )
    target.refunds.append(refund)

    # If fully refunded, flip line status (simple rule: refunded_total >= unit_price)
    if round(target.refunded_total, 2) >= round(target.unit_price, 2):
        target.status = "refunded"

    # Update overall status and timestamp
    parsed.status = parsed.derive_overall_status()
    parsed.updated_at = datetime.now(timezone.utc)

    doc = await DB.db["event_transactions"].find_one_and_replace(
        {"_id": tx["_id"]},
        parsed.to_mongo(),
        return_document=ReturnDocument.AFTER,
    )
    return EventTransaction.parse_obj(doc) if doc else None


async def update_transaction_status(order_id: str, new_status: TxnStatus) -> Optional[EventTransaction]:
    doc = await DB.db["event_transactions"].find_one_and_update(
        {"order_id": order_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    return EventTransaction.parse_obj(doc) if doc else None


# ----------------------------
# Queries (reads)
# ----------------------------

async def get_transaction_by_id(_id: Any) -> Optional[EventTransaction]:
    doc = await DB.db["event_transactions"].find_one({"_id": _id})
    return EventTransaction.parse_obj(doc) if doc else None


async def get_transaction_by_order_id(order_id: str) -> Optional[EventTransaction]:
    doc = await DB.db["event_transactions"].find_one({"order_id": order_id})
    return EventTransaction.parse_obj(doc) if doc else None


async def list_transactions_by_instance(
    event_instance_id: str,
    *,
    status: Optional[TxnStatus] = None,
    limit: int = 100,
    skip: int = 0,
) -> List[EventTransaction]:
    q: Dict[str, Any] = {"event_instance_id": event_instance_id}
    if status:
        q["status"] = status
    cursor = DB.db["event_transactions"].find(q).sort("created_at", DESCENDING).skip(skip).limit(limit)
    return [EventTransaction.parse_obj(doc) async for doc in cursor]


async def list_transactions_by_payer(
    payer_uid: str,
    *,
    limit: int = 100,
    skip: int = 0,
) -> List[EventTransaction]:
    cursor = DB.db["event_transactions"].find({"payer_uid": payer_uid}).sort("created_at", DESCENDING).skip(skip).limit(limit)
    return [EventTransaction.parse_obj(doc) async for doc in cursor]


async def list_transactions_by_event(
    event_id: str,
    *,
    limit: int = 100,
    skip: int = 0,
) -> List[EventTransaction]:
    cursor = DB.db["event_transactions"].find({"event_id": event_id}).sort("created_at", DESCENDING).skip(skip).limit(limit)
    return [EventTransaction.parse_obj(doc) async for doc in cursor]
