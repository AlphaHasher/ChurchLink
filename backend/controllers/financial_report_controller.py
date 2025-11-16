from __future__ import annotations

from time import perf_counter
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, Request, status

from mongo.database import DB
from models.financial_report import (
    FinancialReportConfig,
    FinancialReportRecord,
    FinancialReportOut,
    FinancialReportSearchParams,
    CurrencyTotals,
    FinancialReportStats,
    RefundProcessingSummary,
    RefundRequestSummary,
    insert_financial_report,
    get_financial_report_by_id,
    search_financial_reports,
)
from controllers.transactions_controller import (
    AdminTransactionSearch,
    UnifiedTransaction,
    _query_transactions_common,
)


async def _collect_unified_transactions_for_config(
    config: FinancialReportConfig,
    admin_uid: Optional[str],
) -> List[UnifiedTransaction]:
    """
    Pull all UnifiedTransaction objects matching the config filters.

    Uses the same underlying logic as /admin-transactions/search, but loops
    through all pages to feed the report generator.
    """
    search_body = AdminTransactionSearch(
        kinds=config.kinds,
        statuses=config.statuses,
        created_from=config.created_from,
        created_to=config.created_to,
        page=1,
        page_size=200,
        include_raw=False,
    )

    all_txs: List[UnifiedTransaction] = []

    while True:
        resp = await _query_transactions_common(
            body=search_body,
            uid=admin_uid,
            is_admin=True,
            admin_extras=search_body,
        )

        items = resp.get("items") or []
        for item in items:
            # items are plain dicts → hydrate into UnifiedTransaction models
            all_txs.append(UnifiedTransaction.model_validate(item))

        has_more = resp.get("has_more", False)
        next_page = resp.get("next_page")
        if not has_more or not next_page:
            break

        search_body.page = int(next_page)

    return all_txs


def _accumulate_currency_bucket(
    bucket: Dict[str, Dict[str, Any]],
    currency: str,
    gross: float,
    fee: float,
    net_before: float,
    refunded: float,
    net_after: float,
) -> None:
    cur = bucket.setdefault(
        currency,
        {
            "currency": currency,
            "gross_total": 0.0,
            "fee_total": 0.0,
            "net_before_refunds_total": 0.0,
            "refunded_total": 0.0,
            "net_after_refunds_total": 0.0,
        },
    )
    cur["gross_total"] += gross
    cur["fee_total"] += fee
    cur["net_before_refunds_total"] += net_before
    cur["refunded_total"] += refunded
    cur["net_after_refunds_total"] += net_after


async def _compute_refund_request_summary(
    config: FinancialReportConfig,
) -> RefundRequestSummary:
    """
    Aggregate refund request metrics, aligned with the report's time window.
    """
    if not config.include_refund_requests:
        return RefundRequestSummary()

    coll = DB.db["refund_requests"]
    query: Dict[str, Any] = {}

    if config.created_from or config.created_to:
        time_filter: Dict[str, Any] = {}
        if config.created_from:
            time_filter["$gte"] = config.created_from
        if config.created_to:
            time_filter["$lte"] = config.created_to
        query["created_on"] = time_filter

    # Restrict to relevant txn kinds, if the config narrowed them
    allowed_txn_kinds = {k for k in config.kinds if k in ("event", "form")}
    if allowed_txn_kinds:
        query["txn_kind"] = {"$in": list(allowed_txn_kinds)}

    docs = await coll.find(query).to_list(length=None)

    total = len(docs)
    responded = 0
    resolved = 0
    unresolved = 0

    for d in docs:
        responded_flag = bool(d.get("responded", False))
        resolved_flag = bool(d.get("resolved", False))

        if responded_flag:
            responded += 1
            if resolved_flag:
                resolved += 1
            else:
                unresolved += 1

    return RefundRequestSummary(
        total_requests=total,
        responded_count=responded,
        resolved_count=resolved,
        unresolved_count=unresolved,
    )


async def _compute_financial_stats_for_config(
    config: FinancialReportConfig,
    admin_uid: Optional[str],
) -> FinancialReportStats:
    """
    Core metrics computation:
      - totals by currency
      - totals by kind+currency
      - refund aggregates
      - refund request aggregates
    """
    txs = await _collect_unified_transactions_for_config(config, admin_uid)

    totals_by_currency_raw: Dict[str, Dict[str, Any]] = {}
    totals_by_kind_raw: Dict[str, Dict[str, Dict[str, Any]]] = {}

    total_refund_entries = 0
    total_refunded_amount = 0.0

    for tx in txs:
        currency = tx.currency or "USD"
        kind = tx.kind

        gross = tx.gross_amount if tx.gross_amount is not None else (tx.amount or 0.0)
        fee = tx.fee_amount or 0.0
        net_before = (
            tx.net_amount_before_refunds
            if tx.net_amount_before_refunds is not None
            else gross - fee
        )
        refunded = tx.refunded_total or 0.0
        net_after = (
            tx.net_amount
            if tx.net_amount is not None
            else net_before - refunded
        )

        # Global per-currency totals
        _accumulate_currency_bucket(
            totals_by_currency_raw,
            currency,
            gross,
            fee,
            net_before,
            refunded,
            net_after,
        )

        # Per-kind per-currency totals
        kind_bucket = totals_by_kind_raw.setdefault(kind, {})
        _accumulate_currency_bucket(
            kind_bucket,
            currency,
            gross,
            fee,
            net_before,
            refunded,
            net_after,
        )

        # Refund aggregates
        refunds_list = tx.refunds or []
        total_refund_entries += len(refunds_list)
        total_refunded_amount += refunded

    totals_by_currency = {
        c: CurrencyTotals(**vals) for c, vals in totals_by_currency_raw.items()
    }
    totals_by_kind: Dict[str, Dict[str, CurrencyTotals]] = {
        kind: {c: CurrencyTotals(**vals) for c, vals in cur_map.items()}
        for kind, cur_map in totals_by_kind_raw.items()
    }

    refund_requests_summary = await _compute_refund_request_summary(config)

    return FinancialReportStats(
        total_transactions=len(txs),
        totals_by_currency=totals_by_currency,
        totals_by_kind=totals_by_kind,
        refunds=RefundProcessingSummary(
            total_refund_entries=total_refund_entries,
            total_refunded_amount=total_refunded_amount,
        ),
        refund_requests=refund_requests_summary,
    )


async def generate_and_save_financial_report(
    request: Request,
    body: FinancialReportConfig,
) -> Dict[str, Any]:
    """
    Generate a full financial report and persist it in the financial_reports collection.
    Returns the saved report as a dict.
    """
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    started = perf_counter()
    stats = await _compute_financial_stats_for_config(body, admin_uid=uid)
    duration_ms = (perf_counter() - started) * 1000.0

    record = FinancialReportRecord(
        config=body,
        stats=stats,
        created_by_uid=uid,
        generation_ms=duration_ms,
        meta={},
    )

    report_id = await insert_financial_report(record)
    out = FinancialReportOut(
        id=report_id,
        **record.model_dump(),
    )
    return out.model_dump()


async def preview_financial_report(
    request: Request,
    body: FinancialReportConfig,
) -> Dict[str, Any]:
    """
    Generate a report on demand WITHOUT saving it.
    Useful for "try out" / ad-hoc analysis in the admin panel.
    """
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    started = perf_counter()
    stats = await _compute_financial_stats_for_config(body, admin_uid=uid)
    duration_ms = (perf_counter() - started) * 1000.0

    record = FinancialReportRecord(
        config=body,
        stats=stats,
        created_by_uid=uid,
        generation_ms=duration_ms,
        meta={"preview": True},
    )

    out = FinancialReportOut(
        id="preview",
        **record.model_dump(),
    )
    data = out.model_dump()
    data["is_preview"] = True
    return data


async def list_saved_financial_reports(
    params: FinancialReportSearchParams,
) -> Dict[str, Any]:
    """
    Thin wrapper around the model-layer search.
    """
    return await search_financial_reports(params)


async def get_saved_financial_report_or_404(id: str) -> Dict[str, Any]:
    report = await get_financial_report_by_id(id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial report not found.",
        )
    return report.model_dump()
