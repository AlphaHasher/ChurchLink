from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal

from bson import ObjectId
from pydantic import BaseModel, Field

from mongo.database import DB


TxnKind = Literal[
    "donation_one_time",
    "donation_subscription",
    "donation_subscription_payment",
    "event",
    "form",
]


class FinancialReportConfig(BaseModel):
    """
    Input / stored configuration that describes what the report covers.
    """
    name: Optional[str] = None
    description: Optional[str] = None

    # Transaction filters
    kinds: List[TxnKind] = Field(
        default_factory=lambda: [
            "donation_one_time",
            "donation_subscription",
            "donation_subscription_payment",
            "event",
            "form",
        ]
    )
    statuses: Optional[List[str]] = None

    created_from: Optional[datetime] = None
    created_to: Optional[datetime] = None

    # Toggles for how deep the report goes
    include_refund_requests: bool = True
    include_breakdown_by_kind: bool = True
    include_breakdown_by_currency: bool = True


class CurrencyTotals(BaseModel):
    currency: str
    gross_total: float = 0.0
    fee_total: float = 0.0
    net_before_refunds_total: float = 0.0
    refunded_total: float = 0.0
    net_after_refunds_total: float = 0.0


class RefundProcessingSummary(BaseModel):
    total_refund_entries: int = 0
    total_refunded_amount: float = 0.0


class RefundRequestSummary(BaseModel):
    total_requests: int = 0
    responded_count: int = 0
    resolved_count: int = 0
    unresolved_count: int = 0

class SubscriptionIntervalStats(BaseModel):
    interval: Literal["WEEK", "MONTH", "YEAR"]

    # How many plans were created/activated in the window
    created_or_activated_count: int = 0
    # Sum of their nominal amounts (same units as donation_subscriptions.amount)
    created_or_activated_amount_total: float = 0.0

    # How many plans were cancelled in the window
    cancelled_count: int = 0
    # Sum of the nominal amounts for cancelled plans
    cancelled_amount_total: float = 0.0

    # Count delta = created_or_activated_count - cancelled_count
    net_active_delta: int = 0
    # Money delta = created_or_activated_amount_total - cancelled_amount_total
    net_amount_delta: float = 0.0


class SubscriptionPlansStats(BaseModel):
    # Totals across all intervals (counts)
    total_created_or_activated: int = 0
    total_cancelled: int = 0
    total_net_active_delta: int = 0

    # Totals across all intervals (money, using donation_subscriptions.amount)
    total_created_or_activated_amount: float = 0.0
    total_cancelled_amount: float = 0.0
    total_net_amount_delta: float = 0.0

    # interval -> SubscriptionIntervalStats
    by_interval: Dict[str, SubscriptionIntervalStats] = Field(default_factory=dict)


class FinancialReportStats(BaseModel):
    """
    Computed metrics...
    """
    total_transactions: int = 0

    # currency -> CurrencyTotals
    totals_by_currency: Dict[str, CurrencyTotals] = Field(default_factory=dict)

    # kind -> currency -> CurrencyTotals
    totals_by_kind: Dict[str, Dict[str, CurrencyTotals]] = Field(default_factory=dict)

    # Breakdown of subscription plan stats
    subscription_plans: SubscriptionPlansStats = Field(default_factory=SubscriptionPlansStats)

    refunds: RefundProcessingSummary = Field(default_factory=RefundProcessingSummary)
    refund_requests: RefundRequestSummary = Field(default_factory=RefundRequestSummary)


class FinancialReportRecord(BaseModel):
    """
    Full stored report document (minus the Mongo _id).
    """
    config: FinancialReportConfig
    stats: FinancialReportStats

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by_uid: Optional[str] = None

    # How long it took to generate, in milliseconds
    generation_ms: Optional[float] = None

    # Free-form metadata for future use
    meta: Dict[str, Any] = Field(default_factory=dict)


class FinancialReportOut(FinancialReportRecord):
    id: str


class FinancialReportSearchParams(BaseModel):
    """
    Search / listing filters for saved reports.
    """
    page: int = 0
    page_size: int = 25

    created_from: Optional[datetime] = None  # filters on created_at
    created_to: Optional[datetime] = None

    name_query: Optional[str] = None
    created_by_uid: Optional[str] = None


COLL_NAME = "financial_reports"


# -----------------------------
# Internal helpers
# -----------------------------


def _doc_to_out(doc: Dict[str, Any]) -> FinancialReportOut:
    return FinancialReportOut.model_validate(
        {
            "id": str(doc.get("_id")),
            "config": doc.get("config") or {},
            "stats": doc.get("stats") or {},
            "created_at": doc.get("created_at"),
            "created_by_uid": doc.get("created_by_uid"),
            "generation_ms": doc.get("generation_ms"),
            "meta": doc.get("meta") or {},
        }
    )


# -----------------------------
# CRUD / persistence helpers
# -----------------------------


async def insert_financial_report(record: FinancialReportRecord) -> str:
    """
    Insert a new report document and return its id as a string.
    """
    coll = DB.db[COLL_NAME]
    doc = record.model_dump()
    res = await coll.insert_one(doc)
    return str(res.inserted_id)


async def get_financial_report_doc_by_id(id: str) -> Optional[Dict[str, Any]]:
    coll = DB.db[COLL_NAME]
    oid = ObjectId(id) if ObjectId.is_valid(id) else id
    doc = await coll.find_one({"_id": oid})
    return doc


async def get_financial_report_by_id(id: str) -> Optional[FinancialReportOut]:
    doc = await get_financial_report_doc_by_id(id)
    if not doc:
        return None
    return _doc_to_out(doc)


async def search_financial_reports(
    params: FinancialReportSearchParams,
) -> Dict[str, Any]:
    """
    Paginated listing of saved reports.

    Supports filtering by:
      - created_at range
      - created_by_uid
      - name substring (config.name)
    """
    coll = DB.db[COLL_NAME]
    match: Dict[str, Any] = {}

    if params.created_from or params.created_to:
        time_filter: Dict[str, Any] = {}
        if params.created_from:
            time_filter["$gte"] = params.created_from
        if params.created_to:
            time_filter["$lte"] = params.created_to
        match["created_at"] = time_filter

    if params.created_by_uid:
        match["created_by_uid"] = params.created_by_uid

    if params.name_query:
        match["config.name"] = {
            "$regex": params.name_query,
            "$options": "i",
        }

    pipeline: List[Dict[str, Any]] = [
        {"$match": match},
        {"$sort": {"created_at": -1}},
        {
            "$facet": {
                "total": [{"$count": "count"}],
                "items": [
                    {
                        "$skip": max(0, params.page) * max(1, params.page_size),
                    },
                    {
                        "$limit": max(1, params.page_size),
                    },
                ],
            }
        },
    ]

    agg = await coll.aggregate(pipeline).to_list(length=1)
    bucket = agg[0] if agg else {"items": [], "total": []}

    total_arr = bucket.get("total") or []
    total = total_arr[0].get("count", 0) if total_arr else 0

    items_raw = bucket.get("items") or []
    items = [_doc_to_out(doc).model_dump() for doc in items_raw]

    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
    }


async def delete_financial_report(id: str) -> Dict[str, Any]:
    coll = DB.db[COLL_NAME]
    oid = ObjectId(id) if ObjectId.is_valid(id) else id
    res = await coll.delete_one({"_id": oid})
    if res.deleted_count == 0:
        return {"success": False, "msg": "Financial report not found"}
    return {"success": True, "msg": "Financial report deleted"}
