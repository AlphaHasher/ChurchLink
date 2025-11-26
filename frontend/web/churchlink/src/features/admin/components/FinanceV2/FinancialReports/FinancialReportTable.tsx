// FinancialReportTable.tsx
// AG Grid table listing previously generated financial reports.

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    AllCommunityModule,
    ColDef,
    ModuleRegistry,
    ValueGetterParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";

import type { FinancialReport } from "@/shared/types/FinancialReport";

import ViewFinancialReportDialog from "@/features/admin/components/FinanceV2/FinancialReports/ViewFinancialReportDialog"
import DownloadFinancialReport from "@/features/admin/components/FinanceV2/FinancialReports/DownloadFinancialReport"



ModuleRegistry.registerModules([AllCommunityModule]);

type Props = {
    data: FinancialReport[];
    total: number;
    loading?: boolean;

    page: number;
    pageSize: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
};

type Row = FinancialReport;

function formatDateTime(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
}

function ServerPager({
    total,
    page,
    pageSize,
    loading,
    onPageChange,
    onPageSizeChange,
}: {
    total: number;
    page: number;
    pageSize: number;
    loading?: boolean;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
}) {
    const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
    const canPrev = page > 0;
    const canNext = page + 1 < totalPages;
    const from = total === 0 ? 0 : page * pageSize + 1;
    const to = Math.min((page + 1) * pageSize, total);

    return (
        <div className="flex items-center justify-between py-2 px-2 text-sm">
            <div className="text-muted-foreground">
                {loading ? "Loading…" : `Showing ${from}-${to} of ${total}`}
            </div>
            <div className="flex items-center gap-2">
                <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    onClick={() => onPageChange?.(Math.max(0, page - 1))}
                    disabled={loading || !canPrev}
                >
                    Prev
                </button>
                <span>
                    Page {Math.min(page + 1, totalPages)} of {totalPages}
                </span>
                <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    onClick={() =>
                        onPageChange?.(Math.min(totalPages - 1, page + 1))
                    }
                    disabled={loading || !canNext}
                >
                    Next
                </button>

                <select
                    className="ml-2 rounded border px-2 py-1"
                    value={pageSize}
                    onChange={(e) =>
                        onPageSizeChange?.(parseInt(e.target.value, 10))
                    }
                    disabled={loading}
                >
                    {[10, 25, 50].map((s) => (
                        <option key={s} value={s}>
                            {s}/page
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

const ActionsCellRenderer = (params: { data?: Row }) => {
    const row = params.data;
    if (!row) return null;

    return (
        <div className="flex items-center justify-end gap-2">
            <ViewFinancialReportDialog report={row} />
            <DownloadFinancialReport report={row} />
        </div>
    );
};

export default function FinancialReportTable({
    data,
    total,
    loading,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
}: Props) {
    const columnDefs: ColDef<Row>[] = useMemo(
        () => [
            {
                headerName: "Name",
                field: "config.name",
                flex: 2,
                minWidth: 220,
                valueGetter: (p: ValueGetterParams<Row, any>) =>
                    p.data?.config?.name || "Untitled report",
            },
            {
                headerName: "Generated",
                field: "created_at",
                flex: 1.5,
                minWidth: 180,
                valueGetter: (p: ValueGetterParams<Row, any>) =>
                    formatDateTime(p.data?.created_at),
            },
            {
                headerName: "Created By",
                field: "created_by_uid",
                flex: 1.5,
                minWidth: 180,
                valueGetter: (p: ValueGetterParams<Row, any>) =>
                    p.data?.created_by_uid || "—",
            },
            {
                headerName: "Transactions",
                field: "stats.total_transactions",
                flex: 1,
                minWidth: 120,
                valueGetter: (p: ValueGetterParams<Row, any>) =>
                    p.data?.stats?.total_transactions ?? 0,
            },
            {
                headerName: "Actions",
                cellRenderer: ActionsCellRenderer as any,
                sortable: false,
                filter: false,
                width: 260,
                pinned: "right",
            },
        ],
        [],
    );

    const defaultColDef: ColDef<Row> = useMemo(
        () => ({
            resizable: true,
            sortable: true,
            filter: true,
        }),
        [],
    );

    return (
        <div className="ag-theme-quartz" style={{ width: "100%", height: 600 }}>
            <AgGridReact<Row>
                rowData={data}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                suppressPaginationPanel={true}
                animateRows={true}
                enableCellTextSelection={true}
                overlayNoRowsTemplate={
                    loading
                        ? "<span>Loading…</span>"
                        : "<span>No financial reports found</span>"
                }
            />

            <ServerPager
                total={total}
                page={page}
                pageSize={pageSize}
                loading={loading}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
            />
        </div>
    );
}
