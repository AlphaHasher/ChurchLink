// RefundRequest.tsx
// Types for refund request flow (user + admin) and related search envelopes.

import type { TransactionSummary } from "./Transactions";

// ---------- Core enums / literals ----------

export type RefundTxnKind = "event" | "form";

export type RefundRequestStatus = "pending" | "resolved" | "unresolved" | "all";

// ---------- Core models ----------

export type RefundRequestHistoryItem = {
    message: string | null;
    responded: boolean;
    resolved: boolean;
    reason: string | null;
    created_on: string;          // ISO timestamp
    responded_to: string | null; // ISO timestamp
};

export type RefundRequest = {
    uid: string;
    txn_kind: RefundTxnKind;
    txn_id: string;

    // User-provided message (required at creation/update time)
    message: string;

    // Admin state
    responded: boolean;
    resolved: boolean;
    reason: string | null;

    created_on: string;          // ISO timestamp
    responded_to: string | null; // ISO timestamp

    history: RefundRequestHistoryItem[];
};

export type RefundRequestWithTransaction = RefundRequest & {
    id: string;                                      // Mongo _id
    transaction: TransactionSummary | null;          // full unified transaction payload
};

// ---------- User-facing payloads ----------

export type CreateRefundRequestPayload = {
    txn_kind: RefundTxnKind;
    txn_id: string;
    message: string;
};

export type CreateRefundRequestResponse = {
    success: boolean;
    msg?: string;
};

// Query params/body for "my refund requests" listing
export type MyRefundRequestSearchParams = {
    page?: number | null;              // 0-based
    pageSize?: number | null;
    status?: RefundRequestStatus | null;
    txn_kind?: RefundTxnKind | null;
};

// ---------- Admin-facing payloads ----------

export type AdminRefundRequestSearchParams = {
    page?: number | null;              // 0-based
    pageSize?: number | null;
    status?: RefundRequestStatus | null;
    txn_kind?: RefundTxnKind | null;
    uid?: string | null;               // optional user filter
};

export type AdminUpdateRefundRequestPayload = {
    id: string;                        // refund request id
    responded: boolean;
    resolved: boolean;
    reason?: string | null;
};

export type AdminUpdateRefundRequestResponse = {
    success: boolean;
    msg?: string;
};

// ---------- Paged envelopes ----------

export type RefundRequestPagedResults = {
    items: RefundRequestWithTransaction[];
    total: number;
    page: number;
    pageSize: number;
};
