import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    AllCommunityModule, ColDef, GridApi, ICellRendererParams, ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import type { ReadAdminPanelEvent } from "@/shared/types/Event";
import type { Ministry } from "@/shared/types/Ministry";
import { CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EditEventDialogV2 from "./EditEventDialogV2";
import DeleteEventDialogV2 from "./DeleteEventDialogV2";
import AssignDiscountCodesDialog from "@/features/admin/components/EventsV2/DiscountCodes/AssignDiscountCodesDialog";

type EventsTableV2Props = {
    rows: ReadAdminPanelEvent[];
    loading?: boolean;

    page: number;
    pageSize: number;
    total: number;
    pages: number;

    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;

    sortByDateAsc: boolean;
    onToggleDateSort?: (asc: boolean) => void;

    ministryMap?: Record<string, string>;

    allMinistries: Ministry[];
    preferredLangCode: string;
    onEdited?: () => void;
};

function makeActionsRenderer(
    allMinistries: Ministry[],
    preferredLangCode: string,
    onEdited?: () => void,
) {
    return function ActionsCellRenderer(props: ICellRendererParams<ReadAdminPanelEvent>) {
        const row = props.data!;
        const navigate = useNavigate();
        return (
            <div className="flex items-center justify-between w-full">
                <div className="flex space-x-2 ml-auto">
                    <button
                        type="button"
                        aria-label="View event instances"
                        title="View event instances"
                        className="p-2 rounded hover:bg-gray-100 border border-transparent"
                        onClick={() => {
                            navigate(`/admin/events/${row.id}?preferred_lang=${encodeURIComponent(preferredLangCode)}`);
                        }}
                    >
                        <CalendarClock size={16} />
                    </button>
                    <AssignDiscountCodesDialog
                        event={row}
                        preferredLangCode={preferredLangCode}
                        onSaved={onEdited}
                    />
                    <EditEventDialogV2
                        event={row}
                        allMinistries={allMinistries}
                        preferredLangCode={preferredLangCode}
                        onEdited={onEdited}
                    />
                    <DeleteEventDialogV2 event={row} onDeleted={onEdited} />
                </div>
            </div>
        );
    };
}

function formatBool(v?: boolean | null) {
    if (v === undefined || v === null) return "";
    return v ? "Yes" : "No";
}

function formatDate(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function formatMinistries(mins?: string[] | null, map?: Record<string, string>) {
    if (!mins || mins.length === 0) return "";
    return mins.map((id) => map?.[id] ?? id).join(", ");
}

function formatAgeRange(minAge?: number | null, maxAge?: number | null) {
    const min = minAge ?? null;
    const max = maxAge ?? null;

    if (min == null && max == null) return "All Ages";
    if (min == null && max != null) return `${max} and Under`;
    if (min != null && max == null) return `${min} and Over`;
    return `${min} to ${max}`;
}

function formatGenderLabel(g?: string | null) {
    switch (g) {
        case "male":
            return "Men Only";
        case "female":
            return "Women Only";
        case "all":
        default:
            return "All Allowed";
    }
}

export default function EventsTableV2(props: EventsTableV2Props) {
    const gridApi = useRef<GridApi | null>(null);

    const ActionsRenderer = useMemo(
        () => makeActionsRenderer(props.allMinistries, props.preferredLangCode, props.onEdited),
        [props.allMinistries, props.preferredLangCode, props.onEdited],
    );

    const colDefs = useMemo<ColDef<ReadAdminPanelEvent>[]>(() => [
        { headerName: "Title", field: "default_title", flex: 2, minWidth: 220 },
        { headerName: "Updated On", valueGetter: (p) => p.data?.updated_on, valueFormatter: (p) => formatDate(p.value), minWidth: 150 },
        { headerName: "Registration Allowed", field: "registration_allowed", valueFormatter: (p) => formatBool(p.value), minWidth: 150, initialWidth: 160 },
        { headerName: "Event Hidden", field: "hidden", valueFormatter: (p) => formatBool(p.value), minWidth: 110, initialWidth: 130 },
        { headerName: "Members Only", field: "members_only", valueFormatter: (p) => formatBool(p.value), minWidth: 110, initialWidth: 130 },
        { // Age Range Allowed Display
            headerName: "Age Range",
            valueGetter: (p) => ({ min: p.data?.min_age ?? null, max: p.data?.max_age ?? null }),
            valueFormatter: (p) => formatAgeRange(p.value?.min, p.value?.max),
            minWidth: 100,
            initialWidth: 130,
        },
        { // Gender Allowed Display
            headerName: "Gender",
            valueGetter: (p) => p.data?.gender ?? "all",
            valueFormatter: (p) => formatGenderLabel(p.value),
            minWidth: 100,
            initialWidth: 120,
        },
        {  // Discount Codes count
            headerName: "Discount Codes",
            valueGetter: (p) => (Array.isArray(p.data?.discount_codes) ? p.data!.discount_codes.length : 0),
            minWidth: 130, initialWidth: 140,
        },
        {
            // Ministries Display
            headerName: "Ministries",
            valueGetter: (p) => p.data?.ministries,
            valueFormatter: (p) => formatMinistries(p.value, props.ministryMap),
            flex: 1,
            minWidth: 200,
        },
        // Actions
        { headerName: "Actions", cellRenderer: ActionsRenderer as any, pinned: "right", minWidth: 110, maxWidth: 140 },
    ], [props.ministryMap, ActionsRenderer]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: false,
        resizable: true,
        suppressHeaderMenuButton: true,
    }), []);

    // ---- Server pager ----
    const totalPages = Math.max(1, Math.ceil((props.total || 0) / (props.pageSize || 10)));
    const canPrev = props.page > 1;
    const canNext = props.page < totalPages;
    const from = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
    const to = Math.min(props.page * props.pageSize, props.total);

    return (
        <div className="ag-theme-quartz" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "1 1 auto" }}>
                <AgGridReact<ReadAdminPanelEvent>
                    rowData={props.rows}
                    columnDefs={colDefs}
                    defaultColDef={defaultColDef}
                    suppressCellFocus
                    animateRows
                    onGridReady={(ev) => { gridApi.current = ev.api; }}
                    overlayNoRowsTemplate={props.loading ? "Loading..." : "No events found"}
                />
            </div>

            {/* Pager */}
            <div className="flex items-center justify-between py-2 text-sm">
                <div className="text-muted-foreground">
                    {props.loading ? "Loading…" : `Showing ${from}-${to} of ${props.total}`}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => props.onPageChange?.(Math.max(1, props.page - 1))}
                        disabled={props.loading || !canPrev}
                    >
                        Prev
                    </button>

                    <span>
                        Page {Math.min(props.page, totalPages)} of {totalPages}
                    </span>

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
