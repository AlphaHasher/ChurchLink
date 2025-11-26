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
    SubscriptionIntervalStats,
    SubscriptionPlansStats,
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

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "responded": {"$sum": {"$cond": [{"$eq": ["$responded", True]}, 1, 0]}},
            "resolved": {"$sum": {"$cond": [{"$and": [{"$eq": ["$responded", True]}, {"$eq": ["$resolved", True]}]}, 1, 0]}},
        }}
    ]
    docs = await coll.aggregate(pipeline).to_list(length=1)

    # Access with defensive defaults
    if docs:
        result = docs[0]
        total = result.get("total", 0)
        responded = result.get("responded", 0)
        resolved = result.get("resolved", 0)
        unresolved = responded - resolved
    else:
        total = responded = resolved = unresolved = 0

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
      - subscription plan aggregates (non-monetary)
    """
    txs = await _collect_unified_transactions_for_config(config, admin_uid)

    totals_by_currency_raw: Dict[str, Dict[str, Any]] = {}
    totals_by_kind_raw: Dict[str, Dict[str, Dict[str, Any]]] = {}

    total_refund_entries = 0
    total_refunded_amount = 0.0

    # Only count monetary transactions; plan rows are handled separately.
    monetary_tx_count = 0

    for tx in txs:
        kind = tx.kind

        # donation_subscription == plan setup, not a money movement
        if kind == "donation_subscription":
            continue

        currency = tx.currency or "USD"

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

        monetary_tx_count += 1

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
    subscription_plans_summary = await _compute_subscription_plan_stats(config)

    return FinancialReportStats(
        total_transactions=monetary_tx_count,
        totals_by_currency=totals_by_currency,
        totals_by_kind=totals_by_kind,
        subscription_plans=subscription_plans_summary,
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
    uid = request.state.uid

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
    uid = request.state.uid

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

async def _compute_subscription_plan_stats(
    config: FinancialReportConfig,
) -> SubscriptionPlansStats:
    """
    Aggregate donation subscription plan metrics for the report window.

    Donation subscription plans are calcualted for net plans and for monetary value of said plans
    """
    # If the caller explicitly excluded donation_subscription from the kinds
    # filter, skip this computation.
    if "donation_subscription" not in (config.kinds or []):
        return SubscriptionPlansStats()

    coll = DB.db["donation_subscriptions"]

    # ---------- Plans CREATED / ACTIVATED (by created_at) ----------
    created_query: Dict[str, Any] = {}
    if config.created_from or config.created_to:
        time_filter: Dict[str, Any] = {}
        if config.created_from:
            time_filter["$gte"] = config.created_from
        if config.created_to:
            time_filter["$lte"] = config.created_to
        created_query["created_at"] = time_filter

    created_docs = await coll.find(created_query).to_list(length=None)

    # Local accumulator per interval:
    #   interval -> {
    #       "created_count", "created_amount",
    #       "cancelled_count", "cancelled_amount",
    #   }
    interval_buckets: Dict[str, Dict[str, float]] = {}

    def _norm_interval(raw: Any) -> str:
        if raw is None:
            return "MONTH"
        iv = str(raw).upper()
        if iv not in ("WEEK", "MONTH", "YEAR"):
            return "MONTH"
        return iv

    def _amount(doc: Dict[str, Any]) -> float:
        try:
            return float(doc.get("amount") or 0.0)
        except (TypeError, ValueError):
            return 0.0

    for doc in created_docs:
        interval = _norm_interval(doc.get("interval"))
        bucket = interval_buckets.setdefault(
            interval,
            {
                "created_count": 0,
                "created_amount": 0.0,
                "cancelled_count": 0,
                "cancelled_amount": 0.0,
            },
        )
        bucket["created_count"] += 1
        bucket["created_amount"] += _amount(doc)

    # ---------- Plans CANCELLED (by updated_at when status becomes CANCELLED) ----------
    cancel_query: Dict[str, Any] = {"status": "CANCELLED"}
    if config.created_from or config.created_to:
        time_filter: Dict[str, Any] = {}
        if config.created_from:
            time_filter["$gte"] = config.created_from
        if config.created_to:
            time_filter["$lte"] = config.created_to
        cancel_query["updated_at"] = time_filter

    cancelled_docs = await coll.find(cancel_query).to_list(length=None)
    for doc in cancelled_docs:
        interval = _norm_interval(doc.get("interval"))
        bucket = interval_buckets.setdefault(
            interval,
            {
                "created_count": 0,
                "created_amount": 0.0,
                "cancelled_count": 0,
                "cancelled_amount": 0.0,
            },
        )
        bucket["cancelled_count"] += 1
        bucket["cancelled_amount"] += _amount(doc)

    # ---------- Build stats model ----------
    total_created_count = 0
    total_created_amount = 0.0
    total_cancelled_count = 0
    total_cancelled_amount = 0.0

    by_interval_models: Dict[str, SubscriptionIntervalStats] = {}

    for interval, counts in interval_buckets.items():
        created_count = int(counts.get("created_count", 0) or 0)
        created_amount = float(counts.get("created_amount", 0.0) or 0.0)
        cancelled_count = int(counts.get("cancelled_count", 0) or 0)
        cancelled_amount = float(counts.get("cancelled_amount", 0.0) or 0.0)

        net_count = created_count - cancelled_count
        net_amount = created_amount - cancelled_amount

        total_created_count += created_count
        total_created_amount += created_amount
        total_cancelled_count += cancelled_count
        total_cancelled_amount += cancelled_amount

        by_interval_models[interval] = SubscriptionIntervalStats(
            interval=interval,  # type: ignore[arg-type]
            created_or_activated_count=created_count,
            created_or_activated_amount_total=created_amount,
            cancelled_count=cancelled_count,
            cancelled_amount_total=cancelled_amount,
            net_active_delta=net_count,
            net_amount_delta=net_amount,
        )

    return SubscriptionPlansStats(
        total_created_or_activated=total_created_count,
        total_created_or_activated_amount=total_created_amount,
        total_cancelled=total_cancelled_count,
        total_cancelled_amount=total_cancelled_amount,
        total_net_active_delta=total_created_count - total_cancelled_count,
        total_net_amount_delta=total_created_amount - total_cancelled_amount,
        by_interval=by_interval_models,
    )
