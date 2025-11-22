// Transactions.tsx
// THIS FILE CONTAINS TYPES FOR UNIFIED TRANSACTIONS
// (one-time + recurring donations, event payments, and form payments).

import { DonationCurrency, DonationInterval } from "./Donations";

// ---------- Core enums / literals ----------

export type TransactionKind =
    | "donation_one_time"
    | "donation_subscription"          // Donation Plan
    | "donation_subscription_payment"  // Donation Plan Payment
    | "event"
    | "form";

// Sort mode is intentionally simple for now; extend if/when needed.
export type TransactionSortMode = "created_desc" | "created_asc";

// Currency across all ledgers. Right now everything is USD, but we
// allow a generic string so we don't have to refactor if that changes.
export type TransactionCurrency = DonationCurrency | string;

export type TransactionRefundEntry = {
    // Basic identity
    refund_id?: string | null;

    // Money
    amount: number;
    currency?: TransactionCurrency | null;

    // Why / how
    reason?: string | null;
    created_at?: string | null;
    by_uid?: string | null;
    source?: string | null;

    // For event transactions, the backend will also attach these
    // so you can tie refunds back to specific line items/people.
    line_id?: string | null;
    person_id?: string | null;
    person_display_name?: string | null;
};

// ---------- Search params (request bodies) ----------

// Base search params used by both user + admin endpoints.
// All fields are optional; undefined means "don't filter on this".
export type TransactionSearchParams = {
    // Which kinds of transactions to include; default is "all kinds" when omitted.
    kinds?: TransactionKind[] | null;

    // Filter by status as stored in the underlying ledger:
    // - donations/forms/events: "created" | "captured" | "failed" | ...
    // - subscriptions: "APPROVAL_PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED"
    statuses?: string[] | null;

    // PayPal identifiers (only 1 of these is typically used at a time)
    paypal_order_id?: string | null;
    paypal_capture_id?: string | null;
    paypal_subscription_id?: string | null;

    // Created_at time range; ISO 8601 strings
    created_from?: string | null;
    created_to?: string | null;

    // Pagination (1-based page index)
    page?: number | null;
    page_size?: number | null;

    // Sorting; defaults to "created_desc" server-side when omitted
    sort?: TransactionSortMode | null;

    // If true, backend will include the raw DB document in each item (debug/admin only)
    include_raw?: boolean | null;
};

// Admin search params extend the base params with extra filters.
// These are only honored by the admin endpoint; user endpoint ignores them.
export type AdminTransactionSearchParams = TransactionSearchParams & {
    user_uid?: string | null;          // filter by owning user
    event_id?: string | null;          // filter event transactions by event
    event_instance_id?: string | null; // filter event transactions by specific instance
    form_id?: string | null;           // filter form transactions by form
};

// ---------- Extra payloads per kind (for consumers that want stronger typing) ----------

export type DonationTransactionExtra = {
    message?: string | null;
    meta?: Record<string, any>;
};

export type DonationSubscriptionExtra = {
    interval?: DonationInterval | null;
    message?: string | null;
    meta?: Record<string, any>;
};

export type EventTransactionExtra = {
    event_id?: string | null;
    event_instance_id?: string | null;
    items_count?: number | null;
    meta?: Record<string, any>;
};

export type FormTransactionExtra = {
    form_id?: string | null;
    meta?: Record<string, any>;
};

export type DonationSubscriptionPaymentExtra = {
    subscription_id?: string | null;
    meta?: Record<string, any>;
};

// ---------- Unified transaction shape (response items) ----------

export type TransactionSourceCollection =
    | "donation_transactions"
    | "donation_subscriptions"
    | "event_transactions"
    | "form_transactions"
    | "donation_subscription_payments";

// A unified, normalized transaction row as returned by the transactions endpoints.
// The `extra` field is a flexible blob; when you know the `kind`, you can cast
// it to one of the *_Extra types above for stronger typing in your UI.
export type TransactionSummary = {
    id: string;
    kind: TransactionKind;

    // ISO 8601 timestamps (or null/undefined if missing in a legacy doc)
    created_at?: string | null;
    updated_at?: string | null;

    // Ledger status (see comment on TransactionSearchParams.statuses)
    status?: string | null;

    // Monetary info (legacy “amount the user paid” as originally stored)
    amount?: number | null;
    currency?: TransactionCurrency | null;

    // Detailed processor breakdown (if provided by the backend):
    // - gross_amount: what the payer was originally charged
    // - fee_amount: processor / PayPal fees taken out
    // - net_amount_before_refunds: gross_amount - fee_amount (what the org actually receives before refunds)
    gross_amount?: number | null;
    fee_amount?: number | null;
    net_amount_before_refunds?: number | null;

    // Refund aggregates
    // - refunded_total: total refunded across all entries (if any)
    // - net_amount: net_amount_before_refunds - refunded_total (what “sticks” after refunds)
    refunded_total?: number | null;
    net_amount?: number | null;

    // Detailed refund history
    refunds?: TransactionRefundEntry[];

    // Owning user (donations/forms/events: the payer/donor uid; subs: donor_uid)
    user_uid?: string | null;

    // PayPal identifiers (not all will be present for every kind)
    paypal_order_id?: string | null;
    paypal_capture_id?: string | null;
    paypal_subscription_id?: string | null;

    // Which collection this came from on the backend
    source_collection: TransactionSourceCollection;

    // Kind-specific metadata (see *_Extra types above for expected shapes)
    extra?: Record<string, any>;

    // Optional raw DB document (only included when include_raw = true in search)
    raw?: Record<string, any> | null;
};

// ---------- Paged results envelope ----------

// Standard paginated response from both:
// - POST /transactions/my
// - POST /admin-transactions/search
export type TransactionsResults = {
    items: TransactionSummary[];
    page: number;
    page_size: number;
    has_more: boolean;
    next_page?: number | null;

    // Optional counts / debug info from the backend.
    // `total_fetched` is the number of items considered before applying page slicing.
    counts?: {
        total_fetched: number;
        [key: string]: number;
    } | null;
};

// Convenience aliases if you want to separate user/admin in your UI layer.
// Both endpoints currently share the same envelope + item shape.
export type UserTransactionsResults = TransactionsResults;
export type AdminTransactionsResults = TransactionsResults;
