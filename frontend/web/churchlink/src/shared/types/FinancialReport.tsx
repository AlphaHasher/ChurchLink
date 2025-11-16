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

export type FinancialReportStats = {
    // Count of unified transactions considered for this report
    total_transactions: number;

    // Aggregates grouped by currency, across all kinds
    totals_by_currency: Record<string, FinancialReportCurrencyTotals>;

    // Aggregates grouped by kind then currency:
    //   kind -> currency -> totals
    totals_by_kind: Record<string, Record<string, FinancialReportCurrencyTotals>>;

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
