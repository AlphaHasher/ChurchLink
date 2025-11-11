import { useEffect, useMemo, useRef, useState } from "react";
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

import { useNavigate, useParams } from "react-router-dom";
import { Eye } from "lucide-react";
import { Input } from "@/shared/components/ui/input";

import { currency } from "./EventInstanceSummary";

export type RegistrationsRow = {
    uid: string;
    registrations: number;
    moneyPaid: number;
    moneyDue: number;
};

type Props = {
    rows: RegistrationsRow[];
    loading?: boolean;

    page?: number;
    pageSize?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
};

export function EventInstanceRegistrationsTable({
    rows,
    loading,
    page = 1,
    pageSize = 25,
    onPageChange,
    onPageSizeChange,
}: Props) {
    const apiRef = useRef<GridApi<RegistrationsRow> | null>(null);
    const navigate = useNavigate();
    const { eventId, instanceId } = useParams<{ eventId: string; instanceId: string }>();

    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => row.uid.toLowerCase().includes(term));
    }, [rows, q]);

    useEffect(() => {
        apiRef.current?.setGridOption?.("quickFilterText", "");
    }, [filtered]);

    const ActionsRenderer = useMemo(
        () =>
            function ActionsRenderer(p: ICellRendererParams<RegistrationsRow>) {
                const userId = p.data?.uid;
                const disabled = !eventId || !instanceId || !userId;

                return (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            aria-label="View User Registration"
                            title="View User Registration"
                            className="p-2 rounded hover:bg-gray-100 border border-transparent disabled:opacity-50"
                            disabled={disabled}
                            onClick={() => {
                                if (disabled) return;
                                navigate(
                                    `/admin/events/${eventId}/instance_details/${instanceId}/user_registrations/${userId}`
                                );
                            }}
                        >
                            <Eye size={16} />
                        </button>
                    </div>
                );
            },
        [navigate, eventId, instanceId]
    );

    const colDefs = useMemo<ColDef<RegistrationsRow>[]>(() => [
        { headerName: "UID", field: "uid", flex: 2, minWidth: 220 },
        { headerName: "Registrations", field: "registrations", flex: 1, minWidth: 130 },
        {
            headerName: "Money Paid",
            field: "moneyPaid",
            valueFormatter: (p) => currency(p.value ?? 0),
            flex: 1,
            minWidth: 140,
        },
        {
            headerName: "Money Due",
            field: "moneyDue",
            valueFormatter: (p) => currency(p.value ?? 0),
            flex: 1,
            minWidth: 140,
        },
        {
            headerName: "Actions",
            cellRenderer: ActionsRenderer as any,
            pinned: "right",
            minWidth: 110,
            maxWidth: 160,
        },
    ], [ActionsRenderer]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: false,
        resizable: true,
        suppressHeaderMenuButton: true,
    }), []);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageRows = filtered.slice(startIdx, endIdx);

    const canPrev = safePage > 1;
    const canNext = safePage < totalPages;

    useEffect(() => {
        const api = apiRef.current;
        if (!api) return;
        if (loading) api.showLoadingOverlay();
        else if (pageRows.length === 0) api.showNoRowsOverlay();
        else api.hideOverlay();
    }, [loading, pageRows.length]);

    return (
        <div className="ag-theme-quartz w-full rounded-md border" style={{ display: "flex", flexDirection: "column" }}>
            {/* Controls */}
            <div className="flex items-center justify-between py-2 px-2">
                {/* Left Justified: Search input */}
                <div className="flex items-center gap-2">
                    <Input
                        className="h-9 w-72"
                        placeholder="Search UID…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
                <div />
            </div>

            {/* AG Grid Table */}
            <div className="px-2">
                <AgGridReact<RegistrationsRow>
                    rowData={pageRows}
                    columnDefs={colDefs}
                    defaultColDef={defaultColDef}
                    domLayout="autoHeight"
                    suppressCellFocus
                    animateRows
                    onGridReady={(ev) => {
                        apiRef.current = ev.api;
                        (ev.api as any)?.setGridOption?.("quickFilterText", q.trim());
                    }}
                    enableCellTextSelection
                    overlayLoadingTemplate="<span>Loading…</span>"
                    overlayNoRowsTemplate="<span>No registrations to display.</span>"
                />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between py-2 px-2 text-sm">
                <div className="text-muted-foreground">
                    {loading ? "Loading…" : `Showing ${total === 0 ? 0 : startIdx + 1}-${endIdx} of ${total}`}
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
                        {[10, 25, 50].map((s) => (
                            <option key={s} value={s}>{s}/page</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}

export default EventInstanceRegistrationsTable;
