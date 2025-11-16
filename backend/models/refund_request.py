from __future__ import annotations

from typing import Optional, List, Literal, Dict, Any
from datetime import datetime, timezone

from bson import ObjectId
from pydantic import BaseModel, Field

from mongo.database import DB


# -----------------------------
# Models
# -----------------------------

RefundTxnKind = Literal["event", "form"]


class RefundRequestItem(BaseModel):
    message: Optional[str] = None
    responded: bool
    resolved: bool
    reason: Optional[str] = None
    created_on: datetime
    responded_to: Optional[datetime] = None


class RefundRequest(BaseModel):
    uid: str
    txn_kind: RefundTxnKind
    txn_id: str

    # User-provided message (required at API layer)
    message: str

    # Admin state
    responded: bool = False
    resolved: bool = False
    reason: Optional[str] = None

    created_on: datetime = Field(default_factory=datetime.now)
    responded_to: Optional[datetime] = None

    history: List[RefundRequestItem] = Field(default_factory=list)


class RefundRequestOut(RefundRequest):
    # MongoDB _id as string, plus optional transaction payload
    id: str
    transaction: Optional[Any] = None


class RefundRequestIn(BaseModel):
    txn_kind: RefundTxnKind
    txn_id: str
    message: str


class RefundRequestAdminUpdate(BaseModel):
    id: str
    responded: bool
    resolved: bool
    reason: Optional[str] = None


class RefundRequestSearchParams(BaseModel):
    page: int
    pageSize: int
    status: Literal["pending", "resolved", "unresolved", "all"] = "pending"
    txn_kind: Optional[RefundTxnKind] = None
    uid: Optional[str] = None  # optional filter; user routes will set this


# -----------------------------
# Internal helpers
# -----------------------------


def _status_match_for_params(params: RefundRequestSearchParams) -> Dict[str, Any]:
    if params.status == "pending":
        return {"responded": False}
    if params.status == "resolved":
        return {"responded": True, "resolved": True}
    if params.status == "unresolved":
        return {"responded": True, "resolved": False}
    return {}  # "all"


def _to_out_from_doc(doc: Dict[str, Any]) -> RefundRequestOut:
    history_raw = doc.get("history", []) or []
    history_items: List[RefundRequestItem] = [
        RefundRequestItem(**h) for h in history_raw
    ]

    return RefundRequestOut(
        id=str(doc.get("_id")),
        uid=doc["uid"],
        txn_kind=doc["txn_kind"],
        txn_id=str(doc.get("txn_id")),
        message=doc.get("message", ""),
        responded=doc.get("responded", False),
        resolved=doc.get("resolved", False),
        reason=doc.get("reason"),
        created_on=doc.get("created_on"),
        responded_to=doc.get("responded_to"),
        history=history_items,
        transaction=None,
    )


# -----------------------------
# CRUD helpers
# -----------------------------
# (no cross-collection logic here; controller handles that)
# -----------------------------

# CREATE / UPDATE (user-initiated)


async def create_or_update_refund_request_doc(uid: str, payload: RefundRequestIn) -> Dict[str, Any]:
    """
    Low-level create/update operation for the refund_requests collection.
    Does not enforce transaction ownership/eligibility – that belongs in the controller.
    """
    coll = DB.db["refund_requests"]

    message = (payload.message or "").strip()

    existing = await coll.find_one(
        {
            "uid": uid,
            "txn_kind": payload.txn_kind,
            "txn_id": payload.txn_id,
        }
    )

    if not existing:
        new_doc = RefundRequest(
            uid=uid,
            txn_kind=payload.txn_kind,
            txn_id=payload.txn_id,
            message=message,
        ).model_dump()
        res = await coll.insert_one(new_doc)
        ok = getattr(res, "inserted_id", None) is not None
        return {
            "success": bool(ok),
            "msg": "Created refund request" if ok else "Failed to create refund request",
        }

    history_item = RefundRequestItem(
        message=existing.get("message"),
        responded=existing.get("responded", False),
        resolved=existing.get("resolved", False),
        reason=existing.get("reason"),
        created_on=existing.get("created_on", datetime.now(timezone.utc)),
        responded_to=existing.get("responded_to"),
    ).model_dump()

    update = {
        "$push": {"history": history_item},
        "$set": {
            "message": message,
            "responded": False,
            "resolved": False,
            "reason": None,
            "created_on": datetime.now(timezone.utc),
            "responded_to": None,
        },
    }

    res = await coll.update_one({"_id": existing["_id"]}, update)
    ok = res.matched_count > 0
    return {
        "success": bool(ok),
        "msg": "Updated refund request with new entry" if ok else "Failed to update refund request",
    }


# READ – by id / by user + transaction


async def get_refund_request_by_id(id: str) -> Optional[Dict[str, Any]]:
    coll = DB.db["refund_requests"]
    oid = ObjectId(id) if ObjectId.is_valid(id) else id
    doc = await coll.find_one({"_id": oid})
    return doc


async def get_refund_request_by_user_and_txn(
    uid: str,
    txn_kind: RefundTxnKind,
    txn_id: str,
) -> Optional[Dict[str, Any]]:
    coll = DB.db["refund_requests"]
    doc = await coll.find_one(
        {"uid": uid, "txn_kind": txn_kind, "txn_id": txn_id}
    )
    return doc


# READ – search (paged) with filters


async def search_refund_requests(params: RefundRequestSearchParams) -> Dict[str, Any]:
    """
    Server-side search/paging/sort for refund requests.

    Filters:
      - uid (optional)
      - txn_kind (event / form)
      - status (pending / resolved / unresolved / all)
    """
    coll = DB.db["refund_requests"]

    match: Dict[str, Any] = {}

    if params.uid:
        match["uid"] = params.uid
    if params.txn_kind:
        match["txn_kind"] = params.txn_kind

    status_match = _status_match_for_params(params)
    if status_match:
        match.update(status_match)

    pipeline: List[Dict[str, Any]] = [
        {"$match": match},
        {"$sort": {"created_on": -1}},
        {
            "$facet": {
                "total": [{"$count": "count"}],
                "items": [
                    {
                        "$skip": max(0, params.page) * max(1, params.pageSize)
                    },
                    {"$limit": max(1, params.pageSize)},
                ],
            }
        },
    ]

    agg = await coll.aggregate(pipeline).to_list(length=1)
    bucket = agg[0] if agg else {"items": [], "total": []}

    total_arr = bucket.get("total") or []
    total = total_arr[0].get("count", 0) if total_arr else 0

    items_raw = bucket.get("items", []) or []
    items: List[RefundRequestOut] = [
        _to_out_from_doc(doc) for doc in items_raw
    ]

    return {
        "items": [i.model_dump() for i in items],
        "total": total,
        "page": params.page,
        "pageSize": params.pageSize,
    }


# UPDATE – admin POV


async def update_refund_request_admin(update: RefundRequestAdminUpdate) -> Dict[str, Any]:
    coll = DB.db["refund_requests"]
    oid = ObjectId(update.id) if ObjectId.is_valid(update.id) else update.id

    existing = await coll.find_one({"_id": oid})
    if not existing:
        return {"success": False, "msg": "Refund request not found"}

    history_item = RefundRequestItem(
        message=existing.get("message"),
        responded=existing.get("responded", False),
        resolved=existing.get("resolved", False),
        reason=existing.get("reason"),
        created_on=existing.get("created_on", datetime.now(timezone.utc)),
        responded_to=existing.get("responded_to"),
    ).model_dump()

    updates: Dict[str, Any] = {
        "responded": bool(update.responded),
        "resolved": bool(update.resolved),
        "responded_to": datetime.now(timezone.utc),
    }

    if update.reason is not None:
        updates["reason"] = update.reason.strip()

    res = await coll.update_one(
        {"_id": oid},
        {
            "$push": {"history": history_item},
            "$set": updates,
        },
    )

    if res.matched_count == 0:
        return {"success": False, "msg": "Refund request not found"}

    return {"success": True, "msg": "Refund request updated"}


# UPDATE – explicit low-level update helper


async def explicit_update_refund_request(
    filter_query: Dict[str, Any],
    update_data: Dict[str, Any],
):
    return await DB.update_document("refund_requests", filter_query, update_data)


# DELETE – by id


async def delete_refund_request(id: str) -> Dict[str, Any]:
    coll = DB.db["refund_requests"]
    oid = ObjectId(id) if ObjectId.is_valid(id) else id
    res = await coll.delete_one({"_id": oid})
    if res.deleted_count == 0:
        return {"success": False, "msg": "Refund request not found"}
    return {"success": True, "msg": "Refund request deleted"}
