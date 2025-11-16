// FinancialReport.tsx
// Types for admin financial reports, including config, stats, and saved records.

import type { TransactionKind, TransactionCurrency } from "./Transactions";

// ---------- Config & search params ----------

export type FinancialReportConfig = {
    // Optional label/description for humans
    name?: string | null;
    description?: string | null;

    // Which transaction kinds to include; omitting/kinds=null => all.
    kinds?: TransactionKind[] | null;

    // Underlying ledger statuses to include (donations/forms/events/subscriptions).
    statuses?: string[] | null;

    // Time range for transactions included in the report (ISO timestamps)
    created_from?: string | null;
    created_to?: string | null;

    // Flags to control depth of the report
    include_refund_requests?: boolean | null;
    include_breakdown_by_kind?: boolean | null;
    include_breakdown_by_currency?: boolean | null;
};

export type FinancialReportSearchParams = {
    page?: number | null;
    page_size?: number | null;

    // Filter based on when the report itself was generated (created_at)
    created_from?: string | null;
    created_to?: string | null;

    // Case-insensitive substring match on config.name
    name_query?: string | null;

    // Filter by the admin UID who generated the report
    created_by_uid?: string | null;
};

// ---------- Stats structures ----------

export type FinancialReportCurrencyTotals = {
    currency: TransactionCurrency;
    gross_total: number;              // total amount charged to payers
    fee_total: number;                // total processor/PayPal fees
    net_before_refunds_total: number; // gross_total - fee_total
    refunded_total: number;           // total refunded amount
    net_after_refunds_total: number;  // net_before_refunds_total - refunded_total
};

export type FinancialReportRefundProcessingSummary = {
    // Count of individual refund entries across transactions
    total_refund_entries: number;

    // Aggregate of refunded_total across all included transactions
    total_refunded_amount: number;
};

export type FinancialReportRefundRequestSummary = {
    // Count of refund request docs in scope (time range + txn_kind filter)
    total_requests: number;
    responded_count: number;
    resolved_count: number;
    unresolved_count: number;
};

// Subscription plan (recurring donation) stats describe how many plans were
// created/cancelled in the window, by recurrence interval, and the nominal
// amounts associated with those plans.

export type FinancialReportSubscriptionIntervalStats = {
    // Cadence of the plan (matches backend Literal)
    interval: "WEEK" | "MONTH" | "YEAR";

    // Counts for this interval
    // Count of plans created/activated in the window
    created_or_activated_count: number;
    // Sum of amounts for created/activated plans
    created_or_activated_amount_total: number;

    // Count of plans cancelled in the window
    cancelled_count: number;
    // Sum of amounts for cancelled plans
    cancelled_amount_total: number;

    // created_or_activated_count - cancelled_count
    net_active_delta: number;
    // created_or_activated_amount_total - cancelled_amount_total
    net_amount_delta: number;
};

export type FinancialReportSubscriptionPlansStats = {
    // Totals across all intervals (counts)
    total_created_or_activated: number;
    total_cancelled: number;
    total_net_active_delta: number;

    // Totals across all intervals (amounts)
    total_created_or_activated_amount: number;
    total_cancelled_amount: number;
    total_net_amount_delta: number;

    // interval -> stats (keys will be "WEEK" / "MONTH" / "YEAR")
    by_interval: Record<string, FinancialReportSubscriptionIntervalStats>;
};

export type FinancialReportStats = {
    // Count of unified *monetary* transactions considered for this report
    // (subscription plans themselves are excluded; their counts live in subscription_plans)
    total_transactions: number;

    // Aggregates grouped by currency, across all kinds
    totals_by_currency: Record<string, FinancialReportCurrencyTotals>;

    // Aggregates grouped by kind then currency:
    //   kind -> currency -> totals
    totals_by_kind: Record<string, Record<string, FinancialReportCurrencyTotals>>;

    // Subscription-plan breakdown (recurring donation plans)
    subscription_plans: FinancialReportSubscriptionPlansStats;

    // Refunds applied to the underlying transactions
    refunds: FinancialReportRefundProcessingSummary;

    // State of refund requests in the same time window, limited to event/form
    refund_requests: FinancialReportRefundRequestSummary;
};

// ---------- Stored report records ----------

export type FinancialReportRecord = {
    config: FinancialReportConfig;
    stats: FinancialReportStats;

    // When this report was generated (ISO timestamp)
    created_at: string;

    // Admin who triggered the generation
    created_by_uid?: string | null;

    // Wall-clock generation time in milliseconds
    generation_ms?: number | null;

    // Free-form metadata in case the backend annotates reports later
    meta?: Record<string, any> | null;
};

export type FinancialReport = FinancialReportRecord & {
    id: string;
};

// ---------- API payloads ----------

// POST /admin-financial-reports/generate
export type GenerateFinancialReportRequest = FinancialReportConfig;
export type GenerateFinancialReportResponse = FinancialReport;

// POST /admin-financial-reports/preview
export type PreviewFinancialReportRequest = FinancialReportConfig;
export type PreviewFinancialReportResponse = FinancialReport & {
    is_preview?: boolean | null;
};

// GET /admin-financial-reports
export type FinancialReportPagedResults = {
    items: FinancialReport[];
    total: number;
    page: number;
    page_size: number;
};

// GET /admin-financial-reports/{id}
export type GetFinancialReportResponse = FinancialReport;
