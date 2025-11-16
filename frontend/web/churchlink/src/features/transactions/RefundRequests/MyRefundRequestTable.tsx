// MyRefundRequestTable.tsx
// Table for displaying the current user's refund requests.

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

import type { RefundRequestWithTransaction } from "@/shared/types/RefundRequest";
import { formatKindWithExtras, SoftPill } from "../MyTransactionsFormatting";
import RefundRequestResponseDialog from "./RefundRequestResponseDialog";
import { useLocalize } from "@/shared/utils/localizationUtils";

type MyRefundRequestTableProps = {
    rows: RefundRequestWithTransaction[];
    loading?: boolean;

    // 0-based page index
    page: number;
    pageSize: number;
    total: number;

    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    onAfterNewRequest?: () => void;
};

function formatDate(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function getStatusPill(

    row: RefundRequestWithTransaction,
): { label: string; className: string } {
    if (!row.responded) {
        return {
            label: "Pending",
            className: "bg-amber-50 text-amber-700",
        };
    }

    if (row.resolved) {
        return {
            label: "Resolved",
            className: "bg-emerald-50 text-emerald-700",
        };
    }

    return {
        label: "Unresolved",
        className: "bg-slate-50 text-slate-700",
    };
}

function getLocalize(s: string) {
    const localize = useLocalize();
    return localize(s);
}

const StatusCellRenderer = (
    props: ICellRendererParams<RefundRequestWithTransaction>,
) => {
    const row = props.data;
    if (!row) return null;
    const pill = getStatusPill(row);
    return <SoftPill className={pill.className}>{getLocalize(pill.label)}</SoftPill>;
};

const ActionsCellRenderer = (
    props: ICellRendererParams<RefundRequestWithTransaction> & {
        onAfterNewRequest?: () => void;
    },
) => {
    const row = props.data;
    if (!row) return null;

    const onAfterNewRequest =
        (props as any).onAfterNewRequest as (() => void) | undefined;

    return (
        <div className="flex items-center justify-end gap-2">
            <RefundRequestResponseDialog
                request={row}
                onAfterNewRequest={onAfterNewRequest}
            />
        </div>
    );
};

export default function MyRefundRequestTable(props: MyRefundRequestTableProps) {
    const localize = useLocalize();

    const gridApi = useRef<GridApi | null>(null);

    const columnDefs = useMemo<
        ColDef<RefundRequestWithTransaction>[]
    >(
        () => [
            {
                headerName: localize("Date"),
                field: "created_on",
                minWidth: 170,
                valueFormatter: (p) => formatDate(p.value),
                flex: 2,
            },
            {
                headerName: localize("Type"),
                field: "txn_kind",
                minWidth: 180,
                valueGetter: (p: ValueGetterParams<RefundRequestWithTransaction, any>) =>
                    p.data?.transaction ?? null,
                valueFormatter: (p) =>
                    localize(formatKindWithExtras(p.value as any)) ||
                    (localize(p.data?.txn_kind ?? "") || ""),
                flex: 2,
            },
            {
                headerName: localize("Amount"),
                minWidth: 110,
                valueGetter: (p: ValueGetterParams<RefundRequestWithTransaction, any>) => {
                    const tx = p.data?.transaction;
                    return {
                        amount:
                            typeof tx?.gross_amount === "number"
                                ? tx.gross_amount
                                : typeof tx?.amount === "number"
                                    ? tx.amount
                                    : null,
                        currency: tx?.currency ?? null,
                    };
                },
                valueFormatter: (p) => {
                    const amount = p.value?.amount as number | null | undefined;
                    const currency =
                        (p.value?.currency as string | null | undefined) || "USD";
                    if (amount == null) return "";
                    return `${currency} ${amount.toFixed(2)}`;
                },
            },
            {
                headerName: localize("Status"),
                minWidth: 150,
                cellRenderer: StatusCellRenderer as any,
            },
            {
                headerName: localize("Responded On"),
                minWidth: 170,
                valueGetter: (p: ValueGetterParams<RefundRequestWithTransaction, any>) =>
                    p.data?.responded_to ?? null,
                valueFormatter: (p) => formatDate(p.value),
                flex: 2,
            },
            {
                headerName: localize("Actions"),
                cellRenderer: ActionsCellRenderer as any,
                cellRendererParams: {
                    onAfterNewRequest: props.onAfterNewRequest,
                },
                pinned: "right",
                width: 95,
            },
        ],
        [props.onAfterNewRequest],
    );

    const defaultColDef = useMemo<ColDef>(
        () => ({
            sortable: false,
            resizable: true,
            suppressHeaderMenuButton: true,
        }),
        [],
    );

    const totalPages = Math.max(
        1,
        Math.ceil((props.total || 0) / (props.pageSize || 10)),
    );
    const page = Math.min(props.page, totalPages - 1);
    const canPrev = page > 0;
    const canNext = page + 1 < totalPages;
    const from = props.total === 0 ? 0 : page * props.pageSize + 1;
    const to = Math.min((page + 1) * props.pageSize, props.total);

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
                <AgGridReact<RefundRequestWithTransaction>
                    rowData={props.rows}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    suppressCellFocus
                    animateRows
                    onGridReady={(ev) => {
                        gridApi.current = ev.api;
                    }}
                    overlayNoRowsTemplate={
                        props.loading ? localize("Loading...") : localize("No refund requests found")
                    }
                    enableCellTextSelection
                />
            </div>

            {/* Pager (server-controlled) */}
            <div className="flex items-center justify-between py-2 text-sm">
                <div className="text-muted-foreground pl-3">
                    {props.loading
                        ? localize("Loading…")
                        : `${localize("Showing")} ${from}-${to} ${localize("up to")} ${props.total}`}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="rounded border px-2 py-1 disabled:opacity-50"
                        onClick={() => props.onPageChange?.(Math.max(0, page - 1))}
                        disabled={props.loading || !canPrev}
                    >
                        {localize("Previous")}
                    </button>

                    <span>
                        {localize("Page")} {page + 1} {localize("up to")} {totalPages}
                    </span>

                    <button
                        className="rounded border px-2 py-1 disabled:opacity-50"
                        onClick={() =>
                            props.onPageChange?.(
                                Math.min(totalPages - 1, page + 1),
                            )
                        }
                        disabled={props.loading || !canNext}
                    >
                        {localize("Next")}
                    </button>

                    <select
                        className="ml-2 rounded border px-2 py-1"
                        value={props.pageSize}
                        onChange={(e) =>
                            props.onPageSizeChange?.(
                                parseInt(e.target.value, 10),
                            )
                        }
                        disabled={props.loading}
                    >
                        {[10, 25, 50].map((s) => (
                            <option key={s} value={s}>
                                {s}{" "}{localize("per page")}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
