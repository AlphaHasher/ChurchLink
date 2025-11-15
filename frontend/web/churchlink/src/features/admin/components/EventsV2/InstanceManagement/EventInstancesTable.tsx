import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { useNavigate } from "react-router-dom";
import {
    AllCommunityModule, ColDef, GridApi, ICellRendererParams, ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import EditEventInstanceDialog from "./EditEventInstanceDialog";
import type { AdminEventInstance } from "@/shared/types/Event";
import { ClipboardList } from "lucide-react";

type Props = {
    rows: AdminEventInstance[];
    loading?: boolean;

    page: number;
    pageSize: number;
    total: number;
    pages: number;

    sortBySeriesIndexAsc: boolean;
    onToggleSeriesSort?: (asc: boolean) => void;

    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;

    onInstanceSaved?: () => void;
};

function formatDate(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString();
}

export default function EventInstancesTable(props: Props) {
    const gridApi = useRef<GridApi<AdminEventInstance> | null>(null);
    const navigate = useNavigate();

    const colDefs = useMemo<ColDef<AdminEventInstance>[]>(() => [
        { headerName: "Series Index", field: "series_index", minWidth: 120, flex: 1 },
        {
            headerName: "Scheduled Date",
            valueGetter: (p) => (p.data as any)?.date ?? "",
            valueFormatter: (p) => formatDate(p.value),
            minWidth: 200, flex: 2,
        },
        {
            headerName: "Target Date",
            field: "target_date",
            valueFormatter: (p) => formatDate(p.value),
            minWidth: 200, flex: 2,
        },
        {
            headerName: "RSVP Required",
            field: "rsvp_required",
            valueFormatter: (p) => (p.value ? "Yes" : "No"),
            minWidth: 140, flex: 1.2,
        },
        {
            headerName: "Seats Filled",
            field: "seats_filled",
            valueFormatter: (p) => (p.value ?? 0).toString(),
            minWidth: 130, flex: 1.1,
        },
        {
            headerName: "Max Capacity",
            field: "max_spots",
            valueFormatter: (p) => (p.value == null ? "Unlimited" : String(p.value)),
            minWidth: 140, flex: 1.2,
        },
        {
            headerName: "Hidden",
            field: "hidden",
            valueFormatter: (p) => (p.value ? "Yes" : "No"),
            minWidth: 100, flex: 1,
        },
        {
            headerName: "Registration Allowed",
            field: "registration_allowed",
            valueFormatter: (p) => (p.value ? "Yes" : "No"),
            minWidth: 160, flex: 1.2,
        },
        {
            headerName: "Actions",
            cellRenderer: (p: ICellRendererParams<AdminEventInstance>) => (
                <div className="w-full flex justify-end gap-2">

                    <button
                        type="button"
                        aria-label="View Instance Details"
                        title="View Instance Details"
                        className="p-2 rounded hover:bg-gray-100 border border-transparent"
                        onClick={() => {
                            // Route to instances page with the current preferred language attached
                            navigate(`/admin/events/${p.data!.event_id}/instance_details/${p.data!.id}`);
                        }}
                    >
                        <ClipboardList size={16} />
                    </button>

                    {/* Overrides editor */}
                    <EditEventInstanceDialog instance={p.data!} onSaved={props.onInstanceSaved} />
                </div>
            ),
            pinned: "right",
            minWidth: 160,
            maxWidth: 200,
        },
    ], [props.onInstanceSaved]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: false, resizable: true, suppressHeaderMenuButton: true,
    }), []);

    const totalPages = Math.max(1, Math.ceil((props.total || 0) / (props.pageSize || 10)));
    const canPrev = props.page > 1;
    const canNext = props.page < totalPages;
    const from = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
    const to = Math.min(props.page * props.pageSize, props.total);

    return (
        <div className="ag-theme-quartz" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "1 1 auto" }}>
                <AgGridReact<AdminEventInstance>
                    rowData={props.rows}
                    columnDefs={colDefs}
                    defaultColDef={defaultColDef}
                    suppressCellFocus
                    animateRows
                    onGridReady={(ev) => { gridApi.current = ev.api; }}
                    overlayNoRowsTemplate={props.loading ? "Loading..." : "No instances found"}
                    enableCellTextSelection
                />
            </div>

            {/* Footer: while loading, render blank, else show the pagination controls */}
            <div className="flex items-center justify-between py-2 text-sm">
                <div className="text-muted-foreground">
                    {props.loading ? "" : `Showing ${from}-${to} of ${props.total}`}
                </div>

                <div className="flex items-center gap-2">
                    <select
                        className="border rounded px-2 py-1"
                        value={props.sortBySeriesIndexAsc ? "asc" : "desc"}
                        onChange={(e) => props.onToggleSeriesSort?.(e.target.value === "asc")}
                        disabled={props.loading}
                    >
                        <option value="asc">Series Index ↑</option>
                        <option value="desc">Series Index ↓</option>
                    </select>

                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => props.onPageChange?.(Math.max(1, props.page - 1))}
                        disabled={props.loading || !canPrev}
                    >
                        Prev
                    </button>

                    <span>Page {Math.min(props.page, totalPages)} of {totalPages}</span>

                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => props.onPageChange?.(Math.min(totalPages, props.page + 1))}
                        disabled={props.loading || !canNext}
                    >
                        Next
                    </button>

                    <select
                        className="ml-2 border rounded px-2 py-1"
                        value={props.pageSize}
                        onChange={(e) => props.onPageSizeChange?.(parseInt(e.target.value, 10))}
                        disabled={props.loading}
                    >
                        {[10, 25, 50].map((s) => (
                            <option key={s} value={s}>{s}/page</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
