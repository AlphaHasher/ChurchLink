import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { CalendarClock } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import {
    AllCommunityModule,
    ColDef,
    GridApi,
    ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import type { ReadAdminPanelEvent } from "@/shared/types/Event";
import { fetchAdminEventsUsingDiscount } from "@/helpers/EventManagementHelper";

type Props = {
    codeId: string;
    codeLabel?: string;
    triggerVariant?: "ghost" | "outline" | "default";
};

const DEFAULT_PAGE_SIZE = 25;

export default function ViewEventsWithDiscount({
    codeId,
    codeLabel,
    triggerVariant = "ghost",
}: Props) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<ReadAdminPanelEvent[]>([]);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);


    const gridApi = useRef<GridApi<ReadAdminPanelEvent> | null>(null);

    useEffect(() => {
        if (!open) return;
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const items = await fetchAdminEventsUsingDiscount(codeId);
                if (mounted) setRows(items ?? []);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [open, codeId]);

    useEffect(() => {
        setPage(1);
    }, [open, rows.length, pageSize]);

    useEffect(() => {
        const api = gridApi.current;
        if (!api) return;
        if (loading) {
            api.showLoadingOverlay();
        } else if (!loading && rows.length === 0) {
            api.showNoRowsOverlay();
        } else {
            api.hideOverlay();
        }
    }, [loading, rows.length, open]);

    const colDefs = useMemo<ColDef<ReadAdminPanelEvent>[]>(() => [
        { headerName: "Event Name", field: "default_title", flex: 2, minWidth: 220 },
        { headerName: "Event ID", field: "id", flex: 1.4, minWidth: 220 },
        {
            headerName: "Actions",
            minWidth: 140,
            maxWidth: 160,
            pinned: "right",
            cellRenderer: (p: any) => {
                const id = p?.data?.id as string;
                if (!id) return null;
                const href = `/admin/events/${encodeURIComponent(id)}`;
                return (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (window.location.href = href)}
                        title="View instances"
                        className="gap-2"
                    >
                        <CalendarClock className="h-4 w-4" />
                        View
                    </Button>
                );
            },
        },
    ], []);

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
        <>
            <Button
                variant={triggerVariant}
                size="icon"
                title="View events using this code"
                onClick={() => setOpen(true)}
            >
                <CalendarClock className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[900px]">
                    <DialogHeader>
                        <DialogTitle>Events Using This Discount</DialogTitle>
                        <DialogDescription>
                            {codeLabel ? <>Code: <span className="font-medium">{codeLabel}</span></> : "All events that currently include this discount code."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="ag-theme-quartz" style={{ width: "100%", height: "60vh", display: "flex", flexDirection: "column" }}>
                        <div style={{ flex: "1 1 auto" }}>
                            <AgGridReact<ReadAdminPanelEvent>
                                rowData={pageRows}
                                columnDefs={colDefs}
                                defaultColDef={{ sortable: false, resizable: true, suppressHeaderMenuButton: true }}
                                suppressCellFocus
                                animateRows
                                overlayNoRowsTemplate="No events use this discount"
                                onGridReady={(e) => {
                                    gridApi.current = e.api;
                                    // show initial state
                                    if (loading) e.api.showLoadingOverlay();
                                    else if (rows.length === 0) e.api.showNoRowsOverlay();
                                    else e.api.hideOverlay();
                                }}
                            />
                        </div>

                        {/* Pager footer (client-side) */}
                        <div className="flex items-center justify-between py-2 text-sm">
                            <div className="text-muted-foreground">
                                {loading ? "Loading…" : `Showing ${from}-${to} of ${total}`}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    className="px-2 py-1 border rounded disabled:opacity-50"
                                    onClick={() => setPage(Math.max(1, safePage - 1))}
                                    disabled={loading || !canPrev}
                                >
                                    Prev
                                </button>

                                <span>Page {safePage} of {totalPages}</span>

                                <button
                                    className="px-2 py-1 border rounded disabled:opacity-50"
                                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                                    disabled={loading || !canNext}
                                >
                                    Next
                                </button>

                                <select
                                    className="ml-2 border rounded px-2 py-1"
                                    value={pageSize}
                                    onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                                    disabled={loading}
                                >
                                    {[10, 25, 50, 100].map((s) => (
                                        <option key={s} value={s}>{s}/page</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
