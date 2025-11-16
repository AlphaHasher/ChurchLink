// FinancialReport.tsx
// Admin page for generating and viewing financial reports.

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import useUserPermissions from "@/hooks/useUserPermissions";
import { fetchFinancialReports } from "@/helpers/FinancialReportHelper";

import type {
    FinancialReport,
    FinancialReportSearchParams,
} from "@/shared/types/FinancialReport";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Calendar } from "@/shared/components/ui/calendar";

import FinancialReportTable from "@/features/admin/components/FinanceV2/FinancialReports/FinancialReportTable";
import GenerateFinancialReportDialog from "@/features/admin/components/FinanceV2/FinancialReports/GenerateFinancialReportDialog";

const DEFAULT_PAGE_SIZE = 25;

type DateFilterFieldProps = {
    label: string;
    value: Date | null;
    onChange: (value: Date | null) => void;
};

// Helper: pretty short label for date filter
function formatDateLabel(value: Date | null): string {
    if (!value) return "Any date";
    return value.toLocaleDateString();
}

// Local start-of-day with timezone offset, e.g. "2025-11-15T00:00:00-08:00"
function toLocalStartOfDayWithOffset(value: Date | null): string | null {
    if (!value) return null;

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    const localMidnight = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0);
    const offsetMinutes = localMidnight.getTimezoneOffset(); // minutes behind UTC
    const sign = offsetMinutes <= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(abs / 60)).padStart(2, "0");
    const offsetMins = String(abs % 60).padStart(2, "0");
    const offset = `${sign}${offsetHours}:${offsetMins}`;

    return `${year}-${month}-${day}T00:00:00${offset}`;
}

// Local end-of-day with timezone offset, e.g. "2025-11-15T23:59:59-08:00"
function toLocalEndOfDayWithOffset(value: Date | null): string | null {
    if (!value) return null;

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    const localEnd = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59);
    const offsetMinutes = localEnd.getTimezoneOffset();
    const sign = offsetMinutes <= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(abs / 60)).padStart(2, "0");
    const offsetMins = String(abs % 60).padStart(2, "0");
    const offset = `${sign}${offsetHours}:${offsetMins}`;

    return `${year}-${month}-${day}T23:59:59${offset}`;
}

function DateFilterField({ label, value, onChange }: DateFilterFieldProps) {
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-full justify-between text-left font-normal"
                    >
                        <span>{formatDateLabel(value)}</span>
                        <CalendarIcon className="h-4 w-4 opacity-70" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[999]" align="start">
                    <Calendar
                        mode="single"
                        selected={value ?? undefined}
                        onSelect={(d) => onChange(d ?? null)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}

export default function FinancialReportPage() {
    const { permissions, loading: permissionsLoading } = useUserPermissions();
    const hasPermission = permissions?.admin || permissions?.permissions_management;

    const [reports, setReports] = useState<FinancialReport[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [loading, setLoading] = useState(false);

    // Filters for existing reports (not underlying transactions)
    const [createdFrom, setCreatedFrom] = useState<Date | null>(null);
    const [createdTo, setCreatedTo] = useState<Date | null>(null);
    const [nameQuery, setNameQuery] = useState<string>("");
    const [createdByUid, setCreatedByUid] = useState<string>("");

    const [reload, setReload] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

    const refresh = useCallback(async () => {
        if (!hasPermission) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);

        const params: FinancialReportSearchParams = {
            page,
            page_size: pageSize,
            name_query: nameQuery.trim() || null,
            created_by_uid: createdByUid.trim() || null,
            created_from: toLocalStartOfDayWithOffset(createdFrom),
            created_to: toLocalEndOfDayWithOffset(createdTo),
        };

        try {
            const res = await fetchFinancialReports(params);
            if (controller.signal.aborted) return;

            setReports(res.items ?? []);
            setTotal(res.total ?? 0);
        } catch (err) {
            if (!controller.signal.aborted) {
                console.error("[FinancialReportPage] refresh error", err);
                setReports([]);
                setTotal(0);
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [hasPermission, page, pageSize, nameQuery, createdByUid, createdFrom, createdTo, reload]);

    useEffect(() => {
        if (!permissionsLoading && hasPermission) {
            void refresh();
        }
        return () => {
            abortRef.current?.abort();
        };
    }, [permissionsLoading, hasPermission, refresh]);

    const handleNewReportCreated = () => {
        // When a new report is created, go back to first page and trigger reload.
        setPage(0);
        setReload((x) => x + 1);
    };

    if (permissionsLoading) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold mb-4">Financial Reports</h1>
                <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Loading permissions...</div>
                </div>
            </div>
        );
    }

    if (!hasPermission) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold mb-4">Financial Reports</h1>
                <div className="flex items-center justify-center h-32">
                    <div className="text-destructive">
                        You don&apos;t have permission to access this page.
                    </div>
                </div>
            </div>
        );
    }

    const handleClearFilters = () => {
        setCreatedFrom(null);
        setCreatedTo(null);
        setNameQuery("");
        setCreatedByUid("");
        setPage(0);
        setReload((x) => x + 1);
    };

    return (
        <div className="p-6 overflow-x-hidden">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-bold">Financial Reports</h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Generate and review detailed financial reports based on unified
                        transactions, refunds, and refund requests. Reports are stored so
                        you can revisit them later without re-running the heavy calculations.
                    </p>
                </div>

                <GenerateFinancialReportDialog onCreated={handleNewReportCreated} />
            </div>

            {/* Filters for existing reports */}
            <div className="mb-4 grid gap-3 md:grid-cols-4">
                <div className="flex flex-col gap-1">
                    <Label className="text-xs uppercase text-muted-foreground">
                        Report name
                    </Label>
                    <Input
                        value={nameQuery}
                        onChange={(e) => {
                            setNameQuery(e.target.value);
                            setPage(0);
                        }}
                        placeholder="Search by name..."
                    />
                </div>

                <DateFilterField
                    label="Generated from"
                    value={createdFrom}
                    onChange={(d) => {
                        setCreatedFrom(d);
                        setPage(0);
                    }}
                />

                <DateFilterField
                    label="Generated to"
                    value={createdTo}
                    onChange={(d) => {
                        setCreatedTo(d);
                        setPage(0);
                    }}
                />

                <div className="flex flex-col gap-1">
                    <Label className="text-xs uppercase text-muted-foreground">
                        Created by UID
                    </Label>
                    <Input
                        value={createdByUid}
                        onChange={(e) => {
                            setCreatedByUid(e.target.value);
                            setPage(0);
                        }}
                        placeholder="Filter by exact admin UID..."
                    />
                </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                    Use the filters above to narrow down previously generated reports.
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReload((x) => x + 1)}
                        disabled={loading}
                    >
                        {loading ? "Refreshing…" : "Refresh"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                        disabled={loading}
                    >
                        Clear filters
                    </Button>
                </div>
            </div>

            <div className="border rounded-md bg-background">
                <FinancialReportTable
                    data={reports}
                    total={total}
                    loading={loading}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={(p) => setPage(p)}
                    onPageSizeChange={(s) => {
                        setPageSize(s);
                        setPage(0);
                    }}
                />
            </div>
        </div>
    );
}
