import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    AllCommunityModule,
    ColDef,
    GridApi,
    ICellRendererParams,
    ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import type { DiscountCode } from "@/shared/types/Event";
import EditDiscountCodeDialog from "@/features/admin/components/EventsV2/DiscountCodes/EditDiscountCodeDialog";
import DeleteDiscountCodeDialog from "@/features/admin/components/EventsV2/DiscountCodes/DeleteDiscountCodeDialog";
import ViewEventsWithDiscount from "@/features/admin/components/EventsV2/DiscountCodes/ViewEventsWithDiscount";

type Props = {
    rows: DiscountCode[];
    loading?: boolean;
    onEdited?: () => void;

    page?: number;
    pageSize?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
};

function ActionsRendererFactory(onEdited?: () => void) {
    return function ActionsRenderer(p: ICellRendererParams<DiscountCode>) {
        const row = p.data!;
        return (
            <div className="flex items-center justify-end gap-2">
                <ViewEventsWithDiscount codeId={row.id} codeLabel={row.code} />
                <EditDiscountCodeDialog code={row} onSaved={onEdited} />
                <DeleteDiscountCodeDialog code={row} onDeleted={onEdited} />
            </div>
        );
    };
}

function formatBool(v?: boolean | null) {
    if (v === undefined || v === null) return "";
    return v ? "Yes" : "No";
}

const DEFAULT_PAGE_SIZE = 25;

export default function DiscountCodesTable({
    rows,
    loading,
    onEdited,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    onPageChange,
    onPageSizeChange,
}: Props) {
    const gridApi = useRef<GridApi<DiscountCode> | null>(null);

    const colDefs = useMemo<ColDef<DiscountCode>[]>(() => [
        { headerName: "Code", field: "code", flex: 1.2, minWidth: 140 },
        { headerName: "Discount ID", field: "id", flex: 1.6, minWidth: 220 },
        { headerName: "Name", field: "name", flex: 1.6, minWidth: 200 },
        {
            headerName: "Type",
            valueGetter: (p) => (p.data?.is_percent ? "Percent" : "Fixed"),
            minWidth: 120, flex: 1,
        },
        {
            headerName: "Discount",
            valueGetter: (p) => {
                if (!p.data) return "";
                return p.data.is_percent ? `${p.data.discount}%` : `$${p.data.discount.toFixed(2)}`;
            },
            minWidth: 120, flex: 1,
        },
        {
            headerName: "Max Uses",
            valueGetter: (p) => p.data?.max_uses ?? "Unlimited",
            minWidth: 120, flex: 1,
        },
        { headerName: "Active", field: "active", valueFormatter: (p) => formatBool(p.value), minWidth: 100, flex: 0.8 },
        {
            headerName: "Actions",
            cellRenderer: ActionsRendererFactory(onEdited) as any,
            pinned: "right",
            minWidth: 160,
            maxWidth: 200,
        },
    ], [onEdited]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: false,
        resizable: true,
        suppressHeaderMenuButton: true,
    }), []);

    // Client-side pager
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageRows = rows.slice(startIdx, endIdx);

    const canPrev = safePage > 1;
    const canNext = safePage < totalPages;
    const from = total === 0 ? 0 : startIdx + 1;
    const to = endIdx;

    return (
        <div className="ag-theme-quartz" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "1 1 auto" }}>
                <AgGridReact<DiscountCode>
                    rowData={pageRows}
                    columnDefs={colDefs}
                    defaultColDef={defaultColDef}
                    suppressCellFocus
                    animateRows
                    onGridReady={(ev) => { gridApi.current = ev.api; }}
                    overlayNoRowsTemplate={loading ? "Loading..." : "No discount codes found"}
                />
            </div>

            {/* Pager footer */}
            <div className="flex items-center justify-between py-2 text-sm">
                <div className="text-muted-foreground">
                    {loading ? "Loading…" : `Showing ${from}-${to} of ${total}`}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => onPageChange?.(Math.max(1, safePage - 1))}
                        disabled={loading || !canPrev}
                    >
                        Prev
                    </button>

                    <span>Page {safePage} of {totalPages}</span>

                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => onPageChange?.(Math.min(totalPages, safePage + 1))}
                        disabled={loading || !canNext}
                    >
                        Next
                    </button>

                    <select
                        className="ml-2 border rounded px-2 py-1"
                        value={pageSize}
                        onChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
                        disabled={loading}
                    >
                        {[10, 25, 50, 100].map((s) => (
                            <option key={s} value={s}>{s}/page</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
