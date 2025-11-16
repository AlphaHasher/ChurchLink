from __future__ import annotations

from fastapi import APIRouter, Body, Request

from controllers.transactions_controller import (
    BaseTransactionSearch,
    AdminTransactionSearch,
    list_my_transactions,
    admin_search_transactions,
)

transactions_router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"],
)

admin_transactions_router = APIRouter(
    prefix="/admin-transactions",
    tags=["Admin Transactions"],
)




@transactions_router.post("/my")
async def list_my_transactions_route(
    request: Request,
    body: BaseTransactionSearch = Body(...),
):
    return await list_my_transactions(request=request, body=body)


@admin_transactions_router.post("/search")
async def admin_search_transactions_route(
    request: Request,
    body: AdminTransactionSearch = Body(...),
):
    return await admin_search_transactions(request=request, body=body)
