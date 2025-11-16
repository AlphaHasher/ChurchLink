from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Request, Body, Query

from models.refund_request import (
    RefundRequestIn,
    RefundRequestAdminUpdate,
    RefundRequestSearchParams,
)
from controllers.refund_request_controller import (
    create_or_update_refund_request,
    list_my_refund_requests,
    admin_search_refund_requests,
    admin_get_refund_request_by_id,
    admin_update_refund_request,
)

refund_private_router = APIRouter(
    prefix="/refund-requests",
    tags=["Refund Requests (Private)"],
)

admin_refund_router = APIRouter(
    prefix="/admin-refund-requests",
    tags=["Admin Refund Requests"],
)


# -------------------------
# Private routes
# -------------------------


@refund_private_router.post("/create-request")
async def create_refund_request_route(
    request: Request,
    body: RefundRequestIn = Body(...),
):
    return await create_or_update_refund_request(request=request, body=body)


@refund_private_router.get("/my")
async def list_my_refund_requests_route(
    request: Request,
    page: int = Query(0, ge=0),
    pageSize: int = Query(25, ge=1, le=200),
    status: Literal["pending", "resolved", "unresolved", "all"] = Query("pending"),
    txn_kind: Optional[Literal["event", "form"]] = Query(None),
):
    params = RefundRequestSearchParams(
        page=page,
        pageSize=pageSize,
        status=status,
        txn_kind=txn_kind,
    )
    return await list_my_refund_requests(request=request, params=params)


# -------------------------
# Admin routes
# -------------------------


@admin_refund_router.get("/search")
async def admin_search_refund_requests_route(
    page: int = Query(0, ge=0),
    pageSize: int = Query(25, ge=1, le=200),
    status: Literal["pending", "resolved", "unresolved", "all"] = Query("pending"),
    txn_kind: Optional[Literal["event", "form"]] = Query(None),
    uid: Optional[str] = Query(None),
):
    params = RefundRequestSearchParams(
        page=page,
        pageSize=pageSize,
        status=status,
        txn_kind=txn_kind,
        uid=uid,
    )
    return await admin_search_refund_requests(params=params)


@admin_refund_router.get("/get/{id}")
async def admin_get_refund_request_route(id: str):
    return await admin_get_refund_request_by_id(id=id)


@admin_refund_router.post("/respond")
async def admin_respond_to_refund_request_route(
    body: RefundRequestAdminUpdate = Body(...),
):
    return await admin_update_refund_request(body=body)
