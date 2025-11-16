// FinancialReportHelper.tsx
// Admin-only helper functions for generating, previewing, and listing financial reports.

import api from "../api/api";
import type {
    FinancialReportSearchParams,
    GenerateFinancialReportRequest,
    GenerateFinancialReportResponse,
    PreviewFinancialReportRequest,
    PreviewFinancialReportResponse,
    FinancialReportPagedResults,
    GetFinancialReportResponse,
    FinancialReport,
} from "@/shared/types/FinancialReport";

const EMPTY_PAGED_RESULTS: FinancialReportPagedResults = {
    items: [],
    total: 0,
    page: 0,
    page_size: 25,
};

import { convertFinancialReportsToUserTime } from "./TimeFormatter";

function buildSearchQuery(params: FinancialReportSearchParams | undefined | null): Record<string, any> {
    const cleaned: Record<string, any> = { ...(params ?? {}) };

    Object.keys(cleaned).forEach((k) => {
        const v = cleaned[k];
        if (v === null || v === undefined || v === "") delete cleaned[k];
        if (Array.isArray(v) && v.length === 0) delete cleaned[k];
    });

    return cleaned;
}

/**
 * Admin: generate a financial report and persist it to the database.
 */
export async function generateFinancialReport(
    config: GenerateFinancialReportRequest
): Promise<GenerateFinancialReportResponse> {
    try {
        const res = await api.post("/v1/admin-financial-reports/generate", config);
        const data = (res?.data ?? {}) as GenerateFinancialReportResponse;

        if (!data || !data.id) {
            throw new Error("Invalid report response from server");
        }

        return data;
    } catch (err) {
        console.error("[FinancialReportHelper] generateFinancialReport() -> error", err);
        throw err;
    }
}

/**
 * Admin: preview a financial report without saving it.
 */
export async function previewFinancialReport(
    config: PreviewFinancialReportRequest
): Promise<PreviewFinancialReportResponse> {
    try {
        const res = await api.post("/v1/admin-financial-reports/preview", config);
        const data = (res?.data ?? {}) as PreviewFinancialReportResponse;

        if (!data || !data.stats) {
            throw new Error("Invalid preview report response from server");
        }

        return data;
    } catch (err) {
        console.error("[FinancialReportHelper] previewFinancialReport() -> error", err);
        throw err;
    }
}

/**
 * Admin: list saved financial reports (paginated).
 */
export async function fetchFinancialReports(
    params: FinancialReportSearchParams = {}
): Promise<FinancialReportPagedResults> {
    try {
        const q = buildSearchQuery(params);
        const res = await api.get("/v1/admin-financial-reports", { params: q });
        const data = (res?.data ?? {}) as FinancialReportPagedResults;

        if (!data || !Array.isArray(data.items)) {
            return {
                ...EMPTY_PAGED_RESULTS,
                page: params.page ?? 0,
                page_size: params.page_size ?? 25,
            };
        }

        return {
            items: convertFinancialReportsToUserTime(data.items as FinancialReport[]),
            total: data.total ?? data.items.length,
            page: data.page ?? (params.page ?? 0),
            page_size: data.page_size ?? (params.page_size ?? 25),
        };
    } catch (err) {
        console.error("[FinancialReportHelper] fetchFinancialReports() -> error", err);
        return {
            ...EMPTY_PAGED_RESULTS,
            page: params.page ?? 0,
            page_size: params.page_size ?? 25,
        };
    }
}

/**
 * Admin: fetch a single saved financial report by id.
 */
export async function fetchFinancialReportById(
    id: string
): Promise<GetFinancialReportResponse | null> {
    if (!id) return null;

    try {
        const res = await api.get(`/v1/admin-financial-reports/${encodeURIComponent(id)}`);
        const data = (res?.data ?? {}) as GetFinancialReportResponse;

        if (!data || !data.id) {
            return null;
        }

        return data;
    } catch (err) {
        console.error("[FinancialReportHelper] fetchFinancialReportById() -> error", err);
        return null;
    }
}
