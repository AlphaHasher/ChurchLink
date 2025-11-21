// Admin table for displaying unified transactions across all users.

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
} from "@/features/transactions/MyTransactionsFormatting";
import TransactionRefundDialog from "./TransactionRefundDialog";
import CancelDonationSubscriptionDialog from "./CancelDonationSubscriptionDialog";
import ViewAdminTransactionDialog from "./ViewAdminTransactionDialog";

type AdminTransactionsTableProps = {
    rows: TransactionSummary[];
    loading?: boolean;

    page: number;       // 1-based
    pageSize: number;   // 10/25/50
    total: number;

    onAfterRefund?: () => void;
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

function getLineItemCount(row: TransactionSummary | null | undefined): number | null {
    if (!row) return null;
    const { kind, extra } = row;
    const x = extra || {};

    if (kind === "event") {
        const lineItems =
            (x.line_items as any[] | undefined) ||
            (x.lineItems as any[] | undefined) ||
            [];
        if (!Array.isArray(lineItems)) return null;
        return lineItems.length;
    }

    if (kind === "donation_subscription_payment") {
        return 1;
    }

    if (kind === "donation_subscription") {
        return 0;
    }

    return 1;
}

const StatusCellRenderer = (props: ICellRendererParams<TransactionSummary>) => {
    const row = props.data;
    if (!row) return null;
    const { label, className } = getStatusDisplay(row.status, row.kind);
    return <SoftPill className={className}>{label}</SoftPill>;
};

const ActionsCellRenderer = (
    props: ICellRendererParams<TransactionSummary> & { onAfterRefund?: () => void }
) => {
    const row = props.data;
    if (!row) return null;

    const onAfterRefund = (props as any).onAfterRefund as (() => void) | undefined;

    const showRefund =
        (row.kind === "donation_one_time" ||
            row.kind === "donation_subscription_payment" ||
            row.kind === "form" ||
            row.kind === "event");

    return (
        <div className="flex items-center justify-end gap-2">

            {showRefund && (
                <TransactionRefundDialog
                    tx={row}
                    onAfterRefund={onAfterRefund}
                />
            )}

            <CancelDonationSubscriptionDialog tx={row} onAfterCancel={onAfterRefund} />
            <ViewAdminTransactionDialog tx={row} />
        </div>
    );
};

export default function AdminTransactionsTable(props: AdminTransactionsTableProps) {
    const gridApi = useRef<GridApi | null>(null);

    const columnDefs = useMemo<ColDef<TransactionSummary>[]>(() => [
        {
            headerName: "Date",
            field: "created_at",
            minWidth: 170,
            valueFormatter: (p) => formatDate(p.value),
        },
        {
            headerName: "Type",
            field: "kind",
            minWidth: 200,
            valueGetter: (p) => p.data,
            valueFormatter: (p) =>
                formatKindWithExtras(p.value as TransactionSummary | null),
        },
        {
            headerName: "User UID",
            field: "user_uid",
            minWidth: 200,
            valueFormatter: (p) => p.value || "—",
        },
        {
            headerName: "Items",
            minWidth: 90,
            maxWidth: 110,
            valueGetter: (p) => getLineItemCount(p.data!),
            valueFormatter: (p) => (p.value == null ? "—" : String(p.value)),
        },
        {
            headerName: "Amount",
            minWidth: 120,
            valueGetter: (p) => ({
                amount: p.data?.amount ?? null,
                currency: p.data?.currency ?? null,
            }),
            valueFormatter: (p) =>
                formatAmount(p.value?.amount, p.value?.currency),
        },
        {
            headerName: "Refunded",
            minWidth: 120,
            valueGetter: (p) => ({
                amount: p.data?.refunded_total ?? null,
                currency: p.data?.currency ?? null,
            }),
            valueFormatter: (p) =>
                formatAmount(p.value?.amount, p.value?.currency),
        },
        {
            headerName: "Net",
            minWidth: 120,
            valueGetter: (p) => ({
                amount: p.data?.net_amount ?? null,
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
                p.data?.paypal_capture_id || p.data?.paypal_subscription_id,
            valueFormatter: (p) => p.value || "—",
        },
        {
            headerName: "Actions",
            cellRenderer: ActionsCellRenderer as any,
            pinned: "right",
            width: 100,
            cellRendererParams: {
                onAfterRefund: props.onAfterRefund,
            },
        },
    ], [props.onAfterRefund]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: false,
        resizable: true,
        suppressHeaderMenuButton: true,
    }), []);

    const totalPages = Math.max(
        1,
        Math.ceil((props.total || 0) / (props.pageSize || 10)),
    );
    const page = Math.min(props.page, totalPages);
    const canPrev = page > 1;
    const canNext = page < totalPages;
    const from = props.total === 0 ? 0 : (page - 1) * props.pageSize + 1;
    const to = Math.min(page * props.pageSize, props.total || 0);

    return (
        <div
            className="ag-theme-quartz rounded-md border bg-background"
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
                    enableCellTextSelection
                    onGridReady={(ev) => {
                        gridApi.current = ev.api;
                    }}
                    overlayNoRowsTemplate={
                        props.loading ? "Loading..." : "No transactions found"
                    }
                />
            </div>

            {/* Pager */}
            <div className="border-t bg-muted/40 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <div className="text-muted-foreground">
                    {props.total === 0 ? (
                        "No transactions"
                    ) : (
                        <>
                            Showing <span className="font-medium">{from}</span>–
                            <span className="font-medium">{to}</span> of{" "}
                            <span className="font-medium">{props.total}</span>{" "}
                            transactions
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                        onClick={() =>
                            props.onPageChange && props.onPageChange(page - 1)
                        }
                        disabled={!canPrev || props.loading}
                    >
                        Prev
                    </button>
                    <span className="text-xs text-muted-foreground">
                        Page <span className="font-medium">{page}</span> of{" "}
                        <span className="font-medium">{totalPages}</span>
                    </span>
                    <button
                        type="button"
                        className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                        onClick={() =>
                            props.onPageChange && props.onPageChange(page + 1)
                        }
                        disabled={!canNext || props.loading}
                    >
                        Next
                    </button>
                    <select
                        className="ml-2 h-7 rounded border bg-background px-1.5 text-xs"
                        value={props.pageSize}
                        onChange={(e) =>
                            props.onPageSizeChange &&
                            props.onPageSizeChange(Number(e.target.value) || 25)
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
