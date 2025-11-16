// RefundRequestManagement.tsx
// Admin page for managing refund requests (event + form only).

import { useEffect, useRef, useState } from "react";
import RefundRequestTable from "./RefundRequestTable";

import { adminSearchRefundRequests } from "@/helpers/RefundRequestHelper";
import useUserPermissions from "@/hooks/useUserPermissions";

import type {
    RefundRequestStatus,
    RefundRequestWithTransaction,
} from "@/shared/types/RefundRequest";
import type { AdminRefundRequestSearchParams } from "@/shared/types/RefundRequest";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";

import { Button } from "@/shared/components/ui/button";

type SortDir = "asc" | "desc"; // reserved in case we later add server-side sort
type TxnKindFilter = "all" | "event" | "form";

const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const RefundRequestManagement = () => {
    const { permissions, loading: permissionsLoading } = useUserPermissions();

    const [status, setStatus] = useState<RefundRequestStatus>("pending");
    const [txnKindFilter, setTxnKindFilter] = useState<TxnKindFilter>("all");
    const [page, setPage] = useState<number>(0);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

    const [uidInput, setUidInput] = useState<string>("");
    const [uidFilter, setUidFilter] = useState<string>("");

    const [rows, setRows] = useState<RefundRequestWithTransaction[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);

    const [reload, setReload] = useState(0);

    const debounceRef = useRef<number | undefined>(undefined);

    // Same permission gating style as membership management
    const hasPermission = permissions?.admin || permissions?.permissions_management;

    // Debounce UID filter so we don't spam the server on every keystroke
    useEffect(() => {
        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }
        debounceRef.current = window.setTimeout(() => {
            setUidFilter(uidInput.trim());
            setPage(0);
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }
        };
    }, [uidInput]);

    useEffect(() => {
        if (permissionsLoading || !hasPermission) {
            return;
        }

        (async () => {
            setLoading(true);

            const params: AdminRefundRequestSearchParams = {
                page,
                pageSize,
                status,
                txn_kind: txnKindFilter === "all" ? null : txnKindFilter,
                uid: uidFilter || null,
            };

            try {
                const res = await adminSearchRefundRequests(params);
                setRows((res.items as RefundRequestWithTransaction[]) || []);
                setTotal(res.total ?? 0);
            } catch (e) {
                console.error("Failed to load refund requests", e);
            } finally {
                setLoading(false);
            }
        })();
    }, [
        page,
        pageSize,
        status,
        txnKindFilter,
        uidFilter,
        reload,
        permissionsLoading,
        hasPermission,
    ]);

    const handleSortChange = (_field: string, _dir: SortDir) => {
        // Reserved for future server-side sort integration; for now no-op.
        setPage(0);
    };

    const refreshAfterUpdate = () => setReload((x) => x + 1);

    if (permissionsLoading) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold mb-4">Refund Requests</h1>
                <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Loading permissions...</div>
                </div>
            </div>
        );
    }

    if (!hasPermission) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold mb-4">Refund Requests</h1>
                <div className="flex items-center justify-center h-32">
                    <div className="text-destructive">
                        You don't have permission to access this page.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 overflow-x-hidden">
            <h1 className="text-xl font-bold mb-4">Refund Requests</h1>

            <div className="flex flex-col gap-3 mb-4">
                {/* Filters row */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Request status:</span>
                        <div className="inline-flex gap-3 p-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={status === "pending" ? "default" : "outline"}
                                className={
                                    status !== "pending"
                                        ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                        : ""
                                }
                                onClick={() => {
                                    setStatus("pending");
                                    setPage(0);
                                }}
                                aria-pressed={status === "pending"}
                            >
                                Pending
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={status === "resolved" ? "default" : "outline"}
                                className={
                                    status !== "resolved"
                                        ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                        : ""
                                }
                                onClick={() => {
                                    setStatus("resolved");
                                    setPage(0);
                                }}
                                aria-pressed={status === "resolved"}
                            >
                                Resolved
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={status === "unresolved" ? "default" : "outline"}
                                className={
                                    status !== "unresolved"
                                        ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                        : ""
                                }
                                onClick={() => {
                                    setStatus("unresolved");
                                    setPage(0);
                                }}
                                aria-pressed={status === "unresolved"}
                            >
                                Unresolved
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={status === "all" ? "default" : "outline"}
                                className={
                                    status !== "all"
                                        ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                        : ""
                                }
                                onClick={() => {
                                    setStatus("all");
                                    setPage(0);
                                }}
                                aria-pressed={status === "all"}
                            >
                                All
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Transaction type:</span>
                        <Select
                            value={txnKindFilter}
                            onValueChange={(val: TxnKindFilter) => {
                                setTxnKindFilter(val);
                                setPage(0);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Transaction type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All (event + form)</SelectItem>
                                <SelectItem value="event">Event transactions</SelectItem>
                                <SelectItem value="form">Form transactions</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Filter by UID:</span>
                        <input
                            value={uidInput}
                            onChange={(e) => {
                                setUidInput(e.target.value);
                                setPage(0);
                            }}
                            placeholder="Type a user UID…"
                            className="border rounded px-3 py-1 w-80"
                        />
                    </div>
                </div>
            </div>

            <RefundRequestTable
                data={rows}
                total={total}
                loading={loading}
                page={page}
                pageSize={pageSize}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(s) => {
                    setPageSize(s);
                    setPage(0);
                }}
                onSortChange={handleSortChange}
                onSave={refreshAfterUpdate}
            />
        </div>
    );
};

export default RefundRequestManagement;
