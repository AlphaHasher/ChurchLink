// RefundRequestTable.tsx
// AG Grid table for admin refund request management.

import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    AllCommunityModule,
    ColDef,
    GridApi,
    ICellRendererParams,
    ModuleRegistry,
    ValueGetterParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import { fmt } from "@/helpers/MembershipHelper";
import type { RefundRequestWithTransaction } from "@/shared/types/RefundRequest";

import DetailedUserDialog from "@/features/admin/components/Users/BaseUserTable/DetailedUserDialog";
import RefundRequestReviewDialog from "./RefundRequestReviewDialog";
import ViewAdminTransactionDialog from "../Transactions/ViewAdminTransactionDialog";
import TransactionRefundDialog from "../Transactions/TransactionRefundDialog";

type SortDir = "asc" | "desc";

interface RefundRequestTableProps {
    data: RefundRequestWithTransaction[];
    total: number;
    loading?: boolean;

    page: number;
    pageSize: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;

    onSortChange?: (field: string, dir: SortDir) => void;

    onSave?: () => Promise<void> | void;
}

type Row = RefundRequestWithTransaction;

type TableContext = {
    onSave?: () => Promise<void> | void;
};

const ActionsCellRenderer = (props: ICellRendererParams<Row, any>) => {
    const row = props.data as Row | undefined;
    const { onSave } = (props.context || {}) as TableContext;

    if (!row) return null;

    const tx = row.transaction || null;

    return (
        <div className="flex items-center gap-2">

            {/* Admin transaction tools (no nested dialogs inside review) */}
            {tx && (
                <>
                    <ViewAdminTransactionDialog tx={tx} />
                    <TransactionRefundDialog tx={tx} onAfterRefund={onSave} />
                </>
            )}

            {/* Review / resolve status */}
            <RefundRequestReviewDialog request={row} onUpdated={onSave} />

            {/* User inspector */}
            <DetailedUserDialog userId={row.uid} onSaved={onSave} />
        </div>
    );
};

function getStatusLabel(row: Row): string {
    if (!row.responded) return "Pending";
    return row.resolved ? "Resolved" : "Unresolved";
}

export default function RefundRequestTable({
    data,
    total,
    loading,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onSave,
}: RefundRequestTableProps) {
    const gridApiRef = useRef<GridApi | null>(null);

    const columnDefs: ColDef<Row>[] = useMemo(
        () => [
            {
                field: "uid",
                headerName: "UID",
                sortable: true,
                filter: true,
                flex: 3,
                minWidth: 220,
            },
            {
                field: "txn_kind",
                headerName: "Txn Type",
                sortable: true,
                filter: true,
                flex: 1,
                minWidth: 130,
                valueGetter: (p: ValueGetterParams<Row, any>) => {
                    const kind = p.data?.txn_kind;
                    if (kind === "event") return "Event";
                    if (kind === "form") return "Form";
                    return kind || "Unknown";
                },
            },
            {
                field: "transaction",
                headerName: "Amount",
                sortable: false,
                filter: false,
                flex: 2,
                minWidth: 160,
                valueGetter: (p: ValueGetterParams<Row, any>) => {
                    const tx = p.data?.transaction;
                    if (!tx) return "—";
                    const currency = tx.currency || "USD";
                    const gross =
                        typeof tx.gross_amount === "number"
                            ? tx.gross_amount
                            : typeof tx.amount === "number"
                                ? tx.amount
                                : null;
                    if (gross == null) return "—";
                    return `${currency} ${gross.toFixed(2)}`;
                },
            },
            {
                field: "created_on",
                headerName: "Submitted On",
                sortable: true,
                filter: false,
                flex: 2,
                minWidth: 180,
                valueGetter: (p: ValueGetterParams<Row, any>) => fmt(p.data?.created_on),
            },
            {
                // derived
                headerName: "Status",
                sortable: true,
                filter: true,
                flex: 1.5,
                minWidth: 130,
                valueGetter: (p: ValueGetterParams<Row, any>) =>
                    p.data ? getStatusLabel(p.data) : "",
            },
            {
                headerName: "Actions",
                cellRenderer: ActionsCellRenderer,
                sortable: false,
                filter: false,
                width: 195,
            },
        ],
        [],
    );

    const defaultColDef: ColDef<Row> = useMemo(
        () => ({
            resizable: true,
        }),
        [],
    );

    const handleSortChanged = (ev: any) => {
        if (!onSortChange) return;
        const state = ev.api.getColumnState();
        const sorted = state.find((c: any) => c.sort != null);
        if (sorted?.colId) onSortChange(sorted.colId, (sorted.sort as SortDir) ?? "asc");
        else onSortChange("created_on", "asc");
    };

    return (
        <div >
            <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
                <AgGridReact<Row>
                    rowData={data}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    suppressPaginationPanel={true}
                    animateRows={true}
                    enableCellTextSelection={true}
                    onGridReady={(params) => {
                        gridApiRef.current = params.api;
                    }}
                    onSortChanged={handleSortChanged}
                    suppressScrollOnNewData={true}
                    overlayNoRowsTemplate={
                        loading ? "<span></span>" : "<span>No refund requests found</span>"
                    }
                    context={{ onSave } as TableContext}
                />
            </div>

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
        <div className="flex items-center justify-between py-2 text-sm">
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
                    onChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
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
