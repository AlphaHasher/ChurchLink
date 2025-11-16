// MyRefundRequests.tsx
// User-facing page to view their own refund requests.

import { useCallback, useEffect, useRef, useState } from "react";

import MyRefundRequestTable from "./MyRefundRequestTable";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";

import { fetchMyRefundRequests } from "@/helpers/RefundRequestHelper";
import type {
    RefundRequestWithTransaction,
    RefundRequestStatus,
    RefundTxnKind,
    MyRefundRequestSearchParams,
} from "@/shared/types/RefundRequest";
import { useLocalize } from "@/shared/utils/localizationUtils";

const DEFAULT_PAGE_SIZE = 25;
type KindFilter = "all" | RefundTxnKind;

export default function MyRefundRequests() {
    const localize = useLocalize();
    const [rows, setRows] = useState<RefundRequestWithTransaction[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [kindFilter, setKindFilter] = useState<KindFilter>("all");
    const [statusFilter, setStatusFilter] =
        useState<RefundRequestStatus>("pending");

    const reqSeq = useRef(0);

    const refresh = useCallback(async () => {
        const currentReq = ++reqSeq.current;
        setLoading(true);

        const params: MyRefundRequestSearchParams = {
            page,
            pageSize,
            status: statusFilter,
            txn_kind: kindFilter === "all" ? null : kindFilter,
        };

        try {
            const res = await fetchMyRefundRequests(params);
            if (reqSeq.current !== currentReq) return;

            const items = (res.items as RefundRequestWithTransaction[]) ?? [];
            const totalFetched =
                typeof res.total === "number" ? res.total : items.length;

            setRows(items);
            setTotal(totalFetched);
        } catch (err) {
            console.error("[MyRefundRequests] refresh() error", err);
            if (reqSeq.current !== currentReq) return;
            setRows([]);
            setTotal(0);
        } finally {
            if (reqSeq.current === currentReq) {
                setLoading(false);
            }
        }
    }, [page, pageSize, kindFilter, statusFilter]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleChangeKind = (value: string) => {
        setPage(0);
        setKindFilter(value as KindFilter);
    };

    const handleChangeStatus = (value: string) => {
        setPage(0);
        setStatusFilter(value as RefundRequestStatus);
    };

    const handleChangePage = (newPage: number) => {
        setPage(newPage);
    };

    const handleChangePageSize = (newSize: number) => {
        setPage(0);
        setPageSize(newSize);
    };

    return (
        <div className="p-4 md:p-6">
            <div className="mb-4">
                <h1 className="mb-1 text-xl font-semibold">{localize("My Refund Requests")}</h1>
                <p className="text-sm text-muted-foreground">
                    {localize("View the status and responses for refund requests you have submitted for your event and form payments.")}
                </p>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {localize("Transaction Type")}
                    </span>
                    <Select
                        value={kindFilter}
                        onValueChange={handleChangeKind}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder={localize("Filter by type")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{localize("All types")}</SelectItem>
                            <SelectItem value="event">{localize("Event payments")}</SelectItem>
                            <SelectItem value="form">{localize("Form payments")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{localize("Status")}</span>
                    <Select
                        value={statusFilter}
                        onValueChange={handleChangeStatus}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder={localize("Filter by status")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">
                                {localize("Pending (no admin response yet)")}
                            </SelectItem>
                            <SelectItem value="resolved">{localize("Resolved")}</SelectItem>
                            <SelectItem value="unresolved">
                                {localize("Unresolved / needs follow-up")}
                            </SelectItem>
                            <SelectItem value="all">{localize("All statuses")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refresh()}
                        disabled={loading}
                    >
                        {loading ? localize("Refreshing...") : localize("Refresh")}
                    </Button>
                </div>
            </div>

            <p className="text-sm text-muted-foreground">
                {localize("Use the View button in the table to read the details and responses for each refund request. You can also submit another request for the same payment if needed.")}
            </p>

            <div className="mt-2 h-[600px] overflow-hidden rounded-md border bg-background">
                <MyRefundRequestTable
                    rows={rows}
                    loading={loading}
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={handleChangePage}
                    onPageSizeChange={handleChangePageSize}
                    onAfterNewRequest={refresh}
                />
            </div>
        </div>
    );
}
