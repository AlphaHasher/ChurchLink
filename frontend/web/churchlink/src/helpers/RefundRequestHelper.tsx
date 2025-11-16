// RefundRequestHelper.tsx
// Helper functions for the refund request flow (user + admin).

import api from "../api/api";
import type {
    CreateRefundRequestPayload,
    CreateRefundRequestResponse,
    MyRefundRequestSearchParams,
    AdminRefundRequestSearchParams,
    RefundRequestPagedResults,
    RefundRequestWithTransaction,
    AdminUpdateRefundRequestPayload,
    AdminUpdateRefundRequestResponse,
} from "@/shared/types/RefundRequest";
import { convertRefundRequestsToUserTime } from "./TimeFormatter";



// Shared empty paged envelope
const EMPTY_PAGED_RESULTS: RefundRequestPagedResults = {
    items: [],
    total: 0,
    page: 0,
    pageSize: 25,
};

function buildQuery(
    params: MyRefundRequestSearchParams | AdminRefundRequestSearchParams | undefined | null
): Record<string, any> {
    const cleaned: Record<string, any> = { ...(params ?? {}) };

    Object.keys(cleaned).forEach((k) => {
        const v = cleaned[k];
        if (v === null || v === undefined || v === "") delete cleaned[k];
        if (Array.isArray(v) && v.length === 0) delete cleaned[k];
    });

    return cleaned;
}

/**
 * User: create or update a refund request for a given transaction.
 * Backend enforces:
 *  - txn_kind is "event" or "form"
 *  - ownership of the target transaction
 */
export async function createRefundRequest(
    payload: CreateRefundRequestPayload
): Promise<CreateRefundRequestResponse> {
    try {
        if (!payload?.txn_kind || !payload?.txn_id) {
            return { success: false, msg: "Missing transaction information" };
        }
        const trimmedMessage = (payload.message || "").trim();
        if (!trimmedMessage) {
            return { success: false, msg: "Please provide a message describing your refund request" };
        }

        const body: CreateRefundRequestPayload = {
            ...payload,
            message: trimmedMessage,
        };

        const res = await api.post("/v1/refund-requests/create-request", body);
        const data = (res?.data ?? {}) as CreateRefundRequestResponse;

        if (typeof data?.success !== "boolean") {
            return { success: false, msg: "Invalid response from server" };
        }
        return data;
    } catch (err) {
        console.error("[RefundRequestHelper] createRefundRequest() -> error", err);
        return { success: false, msg: "Unable to submit refund request" };
    }
}

/**
 * User: fetch refund requests for the currently authenticated user.
 */
export async function fetchMyRefundRequests(
    params: MyRefundRequestSearchParams = {}
): Promise<RefundRequestPagedResults> {
    try {
        const q = buildQuery(params);
        const res = await api.get("/v1/refund-requests/my", { params: q });
        const data = (res?.data ?? {}) as RefundRequestPagedResults;

        if (!data || !Array.isArray(data.items)) {
            return {
                ...EMPTY_PAGED_RESULTS,
                page: params.page ?? 0,
                pageSize: params.pageSize ?? 25,
            };
        }

        console.log("TEST BEFORE");
        console.log(data.items);
        console.log("TEST AFTER");
        console.log(convertRefundRequestsToUserTime(data.items));

        return {
            items: convertRefundRequestsToUserTime(data.items) ?? [],
            total: data.total ?? data.items.length,
            page: data.page ?? (params.page ?? 0),
            pageSize: data.pageSize ?? (params.pageSize ?? 25),
        };
    } catch (err) {
        console.error("[RefundRequestHelper] fetchMyRefundRequests() -> error", err);
        return {
            ...EMPTY_PAGED_RESULTS,
            page: params.page ?? 0,
            pageSize: params.pageSize ?? 25,
        };
    }
}

/**
 * Admin: search refund requests across all users.
 */
export async function adminSearchRefundRequests(
    params: AdminRefundRequestSearchParams
): Promise<RefundRequestPagedResults> {
    try {
        const q = buildQuery(params);
        const res = await api.get("/v1/admin-refund-requests/search", { params: q });
        const data = (res?.data ?? {}) as RefundRequestPagedResults;

        if (!data || !Array.isArray(data.items)) {
            return {
                ...EMPTY_PAGED_RESULTS,
                page: params.page ?? 0,
                pageSize: params.pageSize ?? 25,
            };
        }

        return {
            items: data.items,
            total: data.total ?? data.items.length,
            page: data.page ?? (params.page ?? 0),
            pageSize: data.pageSize ?? (params.pageSize ?? 25),
        };
    } catch (err) {
        console.error("[RefundRequestHelper] adminSearchRefundRequests() -> error", err);
        return {
            ...EMPTY_PAGED_RESULTS,
            page: params.page ?? 0,
            pageSize: params.pageSize ?? 25,
        };
    }
}

/**
 * Admin: get a single refund request by id, with attached transaction.
 */
export async function adminGetRefundRequestById(
    id: string
): Promise<RefundRequestWithTransaction | null> {
    if (!id) return null;

    try {
        const res = await api.get(`/v1/admin-refund-requests/get/${encodeURIComponent(id)}`);
        const data = (res?.data ?? {}) as RefundRequestWithTransaction | { success?: boolean };

        // If backend uses an envelope with success flag, handle that gracefully
        if ((data as any)?.success === false) {
            return null;
        }

        if (!data || !("id" in data)) {
            return null;
        }

        return data as RefundRequestWithTransaction;
    } catch (err) {
        console.error("[RefundRequestHelper] adminGetRefundRequestById() -> error", err);
        return null;
    }
}

/**
 * Admin: respond to / update a refund request.
 */
export async function adminRespondToRefundRequest(
    payload: AdminUpdateRefundRequestPayload
): Promise<AdminUpdateRefundRequestResponse> {
    try {
        if (!payload?.id) {
            return { success: false, msg: "Missing refund request id" };
        }

        const res = await api.post("/v1/admin-refund-requests/respond", payload);
        const data = (res?.data ?? {}) as AdminUpdateRefundRequestResponse;

        if (typeof data?.success !== "boolean") {
            return { success: false, msg: "Invalid response from server" };
        }
        return data;
    } catch (err) {
        console.error("[RefundRequestHelper] adminRespondToRefundRequest() -> error", err);
        return { success: false, msg: "Failed to update refund request" };
    }
}
