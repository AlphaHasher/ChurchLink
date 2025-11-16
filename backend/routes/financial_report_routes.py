from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Query, Request

from models.financial_report import (
    FinancialReportConfig,
    FinancialReportSearchParams,
)
from controllers.financial_report_controller import (
    generate_and_save_financial_report,
    preview_financial_report,
    list_saved_financial_reports,
    get_saved_financial_report_or_404,
)

admin_financial_report_router = APIRouter(
    prefix="/admin-financial-reports",
    tags=["Financial Reports"],
)


@admin_financial_report_router.post("/generate")
async def generate_financial_report_route(
    request: Request,
    body: FinancialReportConfig = Body(...),
):
    """
    Generate a financial report according to the provided config
    and persist it in the database.
    """
    return await generate_and_save_financial_report(request=request, body=body)


@admin_financial_report_router.post("/preview")
async def preview_financial_report_route(
    request: Request,
    body: FinancialReportConfig = Body(...),
):
    """
    Generate a financial report according to the provided config
    WITHOUT saving it to the database.
    """
    return await preview_financial_report(request=request, body=body)


@admin_financial_report_router.get("")
async def list_financial_reports_route(
    page: int = Query(0, ge=0),
    page_size: int = Query(25, ge=1, le=200),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    name_query: Optional[str] = Query(None),
    created_by_uid: Optional[str] = Query(None),
):
    """
    Paginated listing of saved reports, with some basic filters.
    """
    params = FinancialReportSearchParams(
        page=page,
        page_size=page_size,
        created_from=created_from,
        created_to=created_to,
        name_query=name_query,
        created_by_uid=created_by_uid,
    )
    return await list_saved_financial_reports(params=params)


@admin_financial_report_router.get("/{id}")
async def get_financial_report_route(id: str):
    """
    Fetch a single saved report by id.
    """
    return await get_saved_financial_report_or_404(id=id)
