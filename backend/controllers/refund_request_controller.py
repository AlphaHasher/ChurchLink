from __future__ import annotations

from typing import Any, Dict, Optional, List, Literal

from bson import ObjectId
from fastapi import HTTPException, Request, status

from mongo.database import DB
from models.refund_request import (
    RefundRequestIn,
    RefundRequestAdminUpdate,
    RefundRequestSearchParams,
    create_or_update_refund_request_doc,
    search_refund_requests as _search_refund_requests,
    get_refund_request_by_id as _get_refund_request_by_id,
    update_refund_request_admin as _update_refund_request_admin,
)
from controllers.transactions_controller import (
    UnifiedTransaction,
    _map_event_doc,
    _map_form_doc,
)

RefundTxnKind = Literal["event", "form"]


async def _load_transaction_doc(
    txn_kind: RefundTxnKind,
    txn_id: str,
) -> Optional[Dict[str, Any]]:
    if txn_kind not in ("event", "form"):
        return None

    coll_name = "event_transactions" if txn_kind == "event" else "form_transactions"
    coll = DB.db[coll_name]

    oid = ObjectId(txn_id) if ObjectId.is_valid(txn_id) else txn_id
    return await coll.find_one({"_id": oid})


async def _load_and_validate_transaction_for_user(
    uid: str,
    txn_kind: RefundTxnKind,
    txn_id: str,
) -> Dict[str, Any]:
    doc = await _load_transaction_doc(txn_kind, txn_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )

    if txn_kind == "event":
        payer_uid = doc.get("payer_uid")
        if payer_uid != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to request a refund for this transaction.",
            )
    else:
        user_id = doc.get("user_id")
        user_id_str = str(user_id) if user_id is not None else None
        if user_id_str != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to request a refund for this transaction.",
            )

    return doc


def _map_txn_to_unified(
    txn_kind: RefundTxnKind,
    doc: Dict[str, Any],
) -> UnifiedTransaction:
    if txn_kind == "event":
        return _map_event_doc(doc, include_raw=False)
    return _map_form_doc(doc, include_raw=False)


async def _attach_transactions_to_result(
    result: Dict[str, Any],
) -> Dict[str, Any]:
    items = result.get("items") or []
    if not items:
        return result

    hydrated: List[Dict[str, Any]] = []

    for item in items:
        txn_kind = item.get("txn_kind")
        txn_id = item.get("txn_id")

        if not txn_kind or not txn_id:
            item["transaction"] = None
            hydrated.append(item)
            continue

        if txn_kind not in ("event", "form"):
            item["transaction"] = None
            hydrated.append(item)
            continue

        doc = await _load_transaction_doc(txn_kind, txn_id)
        if not doc:
            item["transaction"] = None
            hydrated.append(item)
            continue

        unified = _map_txn_to_unified(txn_kind, doc)
        item["transaction"] = unified.model_dump()
        hydrated.append(item)

    result["items"] = hydrated
    return result


async def create_or_update_refund_request(
    request: Request,
    body: RefundRequestIn,
) -> Dict[str, Any]:
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    # Enforce non-empty message from user
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is required.",
        )
    body.message = message

    # Hard gate: only event/form are ever eligible here
    if body.txn_kind not in ("event", "form"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only event and form transactions are eligible for refunds.",
        )

    # Ownership / existence check
    await _load_and_validate_transaction_for_user(
        uid=uid,
        txn_kind=body.txn_kind,  # type: ignore[arg-type]
        txn_id=body.txn_id,
    )

    # Defer actual create/update and history handling to the model layer
    return await create_or_update_refund_request_doc(uid=uid, payload=body)


async def list_my_refund_requests(
    request: Request,
    params: RefundRequestSearchParams,
) -> Dict[str, Any]:
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    # Make sure the query is scoped to this user
    params.uid = uid
    base = await _search_refund_requests(params)
    return await _attach_transactions_to_result(base)


async def admin_search_refund_requests(
    params: RefundRequestSearchParams,
) -> Dict[str, Any]:
    base = await _search_refund_requests(params)
    return await _attach_transactions_to_result(base)


async def admin_get_refund_request_by_id(id: str) -> Dict[str, Any]:
    doc = await _get_refund_request_by_id(id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Refund request not found.",
        )

    txn_kind = doc.get("txn_kind")
    txn_id = doc.get("txn_id")
    transaction_payload: Optional[Dict[str, Any]] = None

    if txn_kind in ("event", "form") and txn_id:
        txn_doc = await _load_transaction_doc(txn_kind, str(txn_id))
        if txn_doc:
            unified = _map_txn_to_unified(txn_kind, txn_doc)
            transaction_payload = unified.model_dump()

    # Import here to avoid circular imports at module import time
    from models.refund_request import _to_out_from_doc

    out = _to_out_from_doc(doc).model_dump()
    out["transaction"] = transaction_payload
    return out


async def admin_update_refund_request(
    body: RefundRequestAdminUpdate,
) -> Dict[str, Any]:
    return await _update_refund_request_admin(body)
