// Table for displaying the current user's transactions (unified across types).

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

import type { TransactionSummary } from "@/shared/types/Transactions";
import {
    SoftPill,
    formatKindWithExtras,
    getStatusDisplay,
} from "./MyTransactionsFormatting";
import ViewTransactionDialog from "./ViewTransactionDialog";
import RequestRefundDialog from "./RequestRefundDialog";
import CancelDonationSubscriptionUserDialog from "./CancelDonationSubscriptionUserDialog";

type MyTransactionsTableProps = {
    rows: TransactionSummary[];
    loading?: boolean;

    page: number; // 1-based
    pageSize: number; // 10/25/50
    total: number;

    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
};

function formatDate(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function formatAmount(amount?: number | null, currency?: string | null) {
    if (amount == null) return "";
    const c = currency || "USD";
    return `${c} ${amount.toFixed(2)}`;
}

// Items count helper
function getLineItemCount(row: TransactionSummary | null | undefined): number | null {
    if (!row) return null;
    const { kind, extra } = row;
    const x = extra || {};

    if (kind === "event") {
        const count =
            (x.items_count as number | undefined) ??
            (x.itemsCount as number | undefined);
        if (typeof count === "number" && count >= 0) return count;
        return null;
    }

    if (
        kind === "donation_subscription_payment" ||
        kind === "donation_one_time" ||
        kind === "form"
    ) {
        return 1;
    }

    if (kind === "donation_subscription") {
        // plan itself, not a specific payment
        return 0;
    }

    return null;
}

// User-facing "net": original amount minus refunded total (ignoring fees)
function getUserNet(row: TransactionSummary | null | undefined): number | null {
    if (!row) return null;
    const gross = typeof row.amount === "number" ? row.amount : null;
    if (gross == null) return null;
    const refunded = typeof row.refunded_total === "number" ? row.refunded_total : 0;
    const net = gross - refunded;
    if (!Number.isFinite(net)) return null;
    return net > 0 ? net : 0;
}

const StatusCellRenderer = (props: ICellRendererParams<TransactionSummary>) => {
    const row = props.data;
    if (!row) return null;
    const { label, className } = getStatusDisplay(row.status, row.kind);
    return <SoftPill className={className}>{label}</SoftPill>;
};

const ActionsCellRenderer = (props: ICellRendererParams<TransactionSummary>) => {
    const row = props.data;
    if (!row) return null;

    const isRefundableKind = row.kind === "event" || row.kind === "form";

    // Use user-facing net (amount - refunded_total), not fee-aware net_amount
    const userNet = getUserNet(row) ?? 0;
    const statusLower = (row.status || "").toLowerCase();
    const isFullyRefunded =
        statusLower === "fully_refunded" ||
        statusLower === "fully refunded" ||
        userNet <= 0.01;

    const showRefundRequest = isRefundableKind && !isFullyRefunded;

    return (
        <div className="flex items-center justify-end gap-2">
            {/* Cancel recurring donation plan (for donation_subscription rows) */}
            <CancelDonationSubscriptionUserDialog tx={row} />

            {/* User-initiated refund request (events/forms) */}
            {showRefundRequest && <RequestRefundDialog tx={row} />}

            {/* View details */}
            <ViewTransactionDialog tx={row} />
        </div>
    );
};

export default function MyTransactionsTable(props: MyTransactionsTableProps) {
    const gridApi = useRef<GridApi | null>(null);

    const columnDefs = useMemo<ColDef<TransactionSummary>[]>(
        () => [
            {
                headerName: "Date",
                field: "created_at",
                minWidth: 170,
                valueFormatter: (p) => formatDate(p.value),
            },
            {
                headerName: "Type",
                field: "kind",
                minWidth: 180,
                valueGetter: (p) => p.data,
                valueFormatter: (p) =>
                    formatKindWithExtras(p.value as TransactionSummary | null),
            },
            {
                headerName: "Items",
                minWidth: 90,
                maxWidth: 110,
                valueGetter: (p) => getLineItemCount(p.data!),
                valueFormatter: (p) =>
                    p.value == null ? "—" : String(p.value),
            },
            {
                headerName: "Amount",
                minWidth: 110,
                valueGetter: (p) => ({
                    amount: p.data?.amount ?? null,
                    currency: p.data?.currency ?? null,
                }),
                valueFormatter: (p) =>
                    formatAmount(p.value?.amount, p.value?.currency),
            },
            {
                headerName: "Refunded",
                minWidth: 110,
                valueGetter: (p) => ({
                    amount: p.data?.refunded_total ?? null,
                    currency: p.data?.currency ?? null,
                }),
                valueFormatter: (p) =>
                    formatAmount(p.value?.amount, p.value?.currency),
            },
            {
                headerName: "Net",
                minWidth: 110,
                valueGetter: (p) => ({
                    amount: getUserNet(p.data!) ?? null,
                    currency: p.data?.currency ?? null,
                }),
                valueFormatter: (p) =>
                    formatAmount(p.value?.amount, p.value?.currency),
            },
            {
                headerName: "Status",
                field: "status",
                minWidth: 150,
                cellRenderer: StatusCellRenderer as any,
            },
            {
                headerName: "Order ID",
                field: "paypal_order_id",
                flex: 1,
                minWidth: 180,
                valueFormatter: (p) => p.value || "—",
            },
            {
                headerName: "Capture / Sub ID",
                flex: 1,
                minWidth: 190,
                valueGetter: (p) =>
                    p.data?.paypal_capture_id ||
                    p.data?.paypal_subscription_id ||
                    null,
                valueFormatter: (p) => p.value || "—",
            },
            {
                headerName: "Actions",
                cellRenderer: ActionsCellRenderer as any,
                pinned: "right",
                minWidth: 130,
                maxWidth: 150,
            },
        ],
        []
    );

    const defaultColDef = useMemo<ColDef>(
        () => ({
            sortable: false,
            resizable: true,
            suppressHeaderMenuButton: true,
        }),
        []
    );

    const totalPages = Math.max(
        1,
        Math.ceil((props.total || 0) / (props.pageSize || 10))
    );
    const page = Math.min(props.page, totalPages);
    const canPrev = page > 1;
    const canNext = page < totalPages;
    const from = props.total === 0 ? 0 : (page - 1) * props.pageSize + 1;
    const to = Math.min(page * props.pageSize, props.total);

    return (
        <div
            className="ag-theme-quartz"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div style={{ flex: "1 1 auto" }}>
                <AgGridReact<TransactionSummary>
                    rowData={props.rows}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    suppressCellFocus
                    animateRows
                    onGridReady={(ev) => {
                        gridApi.current = ev.api;
                    }}
                    overlayNoRowsTemplate={
                        props.loading ? "Loading..." : "No transactions found"
                    }
                    enableCellTextSelection
                />
            </div>

            {/* Pager (server-controlled) */}
            <div className="flex items-center justify-between py-2 text-sm">
                <div className="text-muted-foreground">
                    {props.loading
                        ? "Loading…"
                        : `Showing ${from}-${to} of ${props.total}`}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() =>
                            props.onPageChange?.(Math.max(1, page - 1))
                        }
                        disabled={props.loading || !canPrev}
                    >
                        Prev
                    </button>

                    <span>
                        Page {page} of {totalPages}
                    </span>

                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() =>
                            props.onPageChange?.(Math.min(totalPages, page + 1))
                        }
                        disabled={props.loading || !canNext}
                    >
                        Next
                    </button>

                    <select
                        className="ml-2 border rounded px-2 py-1"
                        value={props.pageSize}
                        onChange={(e) =>
                            props.onPageSizeChange?.(
                                parseInt(e.target.value, 10)
                            )
                        }
                        disabled={props.loading}
                    >
                        {[10, 25, 50].map((s) => (
                            <option key={s} value={s}>
                                {s}/page
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
