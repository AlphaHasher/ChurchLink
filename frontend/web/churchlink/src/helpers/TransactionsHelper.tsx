// TransactionsHelper.tsx
// Helper functions to hit the unified transactions endpoints:
// - POST /v1/transactions/my
// - POST /v1/admin-transactions/search

import api from "../api/api";
import type {
    TransactionSearchParams,
    AdminTransactionSearchParams,
    UserTransactionsResults,
    AdminTransactionsResults,
} from "@/shared/types/Transactions";

import { convertTransactionSummaryToUserTime } from "./TimeFormatter";

function buildBody(params: TransactionSearchParams | AdminTransactionSearchParams): Record<string, any> {
    const body: Record<string, any> = { ...(params ?? {}) };

    Object.keys(body).forEach((k) => {
        const v = body[k];
        if (v === null || v === undefined || v === "") delete body[k];
        if (Array.isArray(v) && v.length === 0) delete body[k];
    });

    return body;
}

const EMPTY_USER_RESULTS: UserTransactionsResults = {
    items: [],
    page: 1,
    page_size: 25,
    has_more: false,
    next_page: null,
    counts: { total_fetched: 0 },
};

const EMPTY_ADMIN_RESULTS: AdminTransactionsResults = {
    items: [],
    page: 1,
    page_size: 25,
    has_more: false,
    next_page: null,
    counts: { total_fetched: 0 },
};

/**
 * Fetch transactions for the currently authenticated user.
 * Uses the /v1/transactions/my endpoint and enforces the caller's uid server-side.
 */
export async function fetchMyTransactions(
    params: TransactionSearchParams = {}
): Promise<UserTransactionsResults> {
    try {
        const body = buildBody(params);
        const res = await api.post("/v1/transactions/my", body);
        const data = (res?.data ?? {}) as UserTransactionsResults;

        if (!data || !Array.isArray(data.items)) {
            return {
                ...EMPTY_USER_RESULTS,
                page: params.page ?? 1,
                page_size: params.page_size ?? 25,
            };
        }

        return {
            items: convertTransactionSummaryToUserTime(data.items) ?? [],
            page: data.page ?? (params.page ?? 1),
            page_size: data.page_size ?? (params.page_size ?? 25),
            has_more: !!data.has_more,
            next_page: data.next_page ?? null,
            counts: data.counts ?? { total_fetched: data.items.length },
        };
    } catch (err) {
        console.error("[TransactionsHelper] fetchMyTransactions() -> error", err);
        return {
            ...EMPTY_USER_RESULTS,
            page: params.page ?? 1,
            page_size: params.page_size ?? 25,
        };
    }
}

/**
 * Admin-only: search transactions across all users/contexts.
 * Uses the /v1/admin-transactions/search endpoint; backend enforces admin perms.
 */
export async function adminSearchTransactions(
    params: AdminTransactionSearchParams
): Promise<AdminTransactionsResults> {
    try {
        const body = buildBody(params);
        const res = await api.post("/v1/admin-transactions/search", body);
        const data = (res?.data ?? {}) as AdminTransactionsResults;

        if (!data || !Array.isArray(data.items)) {
            return {
                ...EMPTY_ADMIN_RESULTS,
                page: params.page ?? 1,
                page_size: params.page_size ?? 25,
            };
        }

        return {
            items: convertTransactionSummaryToUserTime(data.items) ?? [],
            page: data.page ?? (params.page ?? 1),
            page_size: data.page_size ?? (params.page_size ?? 25),
            has_more: !!data.has_more,
            next_page: data.next_page ?? null,
            counts: data.counts ?? { total_fetched: data.items.length },
        };
    } catch (err) {
        console.error("[TransactionsHelper] adminSearchTransactions() -> error", err);
        return {
            ...EMPTY_ADMIN_RESULTS,
            page: params.page ?? 1,
            page_size: params.page_size ?? 25,
        };
    }
}
