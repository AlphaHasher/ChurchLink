// User-facing page to view their own transactions.

import { useEffect, useRef, useState, useCallback } from "react";

import MyTransactionsTable from "./MyTransactionsTable";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";

import { fetchMyTransactions } from "@/helpers/TransactionsHelper";
import type {
    TransactionKind,
    TransactionSortMode,
    TransactionSummary,
    TransactionSearchParams,
} from "@/shared/types/Transactions";
import { getStatusFilterOptionsForKind } from "./MyTransactionsFormatting";

const DEFAULT_PAGE_SIZE = 25;
const ALL_KIND = "all";

type KindFilter = typeof ALL_KIND | TransactionKind;

export default function MyTransactions() {
    const [rows, setRows] = useState<TransactionSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [kindFilter, setKindFilter] = useState<KindFilter>(ALL_KIND);
    const [sortMode, setSortMode] = useState<TransactionSortMode>("created_desc");
    const [statusFilterId, setStatusFilterId] = useState<string>("all");

    const reqSeq = useRef(0);

    const refresh = useCallback(async () => {
        const currentReq = ++reqSeq.current;
        setLoading(true);

        const kinds: TransactionKind[] | undefined =
            kindFilter === ALL_KIND ? undefined : [kindFilter];

        const kindForStatus = kindFilter === ALL_KIND ? "all" : kindFilter;
        const statusOptions = getStatusFilterOptionsForKind(kindForStatus);
        const selectedStatus =
            statusOptions.find((o) => o.id === statusFilterId) ?? statusOptions[0];

        const statuses =
            selectedStatus && selectedStatus.id !== "all"
                ? selectedStatus.statuses
                : undefined;

        const params: TransactionSearchParams = {
            page,
            page_size: pageSize,
            sort: sortMode,
            kinds,
            statuses,
        };

        try {
            const res = await fetchMyTransactions(params);
            if (reqSeq.current !== currentReq) return;

            const items = res.items ?? [];

            const totalFetched = res.counts?.total_fetched ?? items.length;

            setRows(items);
            setTotal(totalFetched);
        } catch (err) {
            console.error("[MyTransactions] refresh() error", err);
            if (reqSeq.current !== currentReq) return;
            setRows([]);
            setTotal(0);
        } finally {
            if (reqSeq.current === currentReq) {
                setLoading(false);
            }
        }
    }, [page, pageSize, kindFilter, sortMode, statusFilterId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleChangeKind = (value: string) => {
        setPage(1);
        setKindFilter(value as KindFilter);
        setStatusFilterId("all");
    };

    const handleChangeSort = (value: string) => {
        setPage(1);
        setSortMode(value as TransactionSortMode);
    };

    const handleChangeStatus = (value: string) => {
        setPage(1);
        setStatusFilterId(value);
    };

    const handleChangePage = (newPage: number) => {
        setPage(newPage);
    };

    const handleChangePageSize = (newSize: number) => {
        setPage(1);
        setPageSize(newSize);
    };

    const kindForStatus = kindFilter === ALL_KIND ? "all" : kindFilter;
    const statusOptions = getStatusFilterOptionsForKind(kindForStatus);

    return (
        <div className="p-4 md:p-6">
            <div className="mb-4">
                <h1 className="text-xl font-semibold mb-1">My Transactions</h1>
                <p className="text-sm text-muted-foreground">
                    Only transactions paid through PayPal will be represented here.
                    Disclaimer: This page has a list of your transactions according to
                    what appears on our ledger. In an edge case of a discrepancy between
                    what appears here and your actual PayPal or bank statements, you should
                    consider your bank information as the ultimate source of truth.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-3">
                {/* Type filter */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <Select
                        value={kindFilter}
                        onValueChange={handleChangeKind}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_KIND}>All types</SelectItem>
                            <SelectItem value="donation_one_time">
                                One-time donations
                            </SelectItem>
                            <SelectItem value="donation_subscription">
                                Donation plans
                            </SelectItem>
                            <SelectItem value="donation_subscription_payment">
                                Donation plan payments
                            </SelectItem>
                            <SelectItem value="event">Event payments</SelectItem>
                            <SelectItem value="form">Form payments</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Sort by date */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Sort</span>
                    <Select
                        value={sortMode}
                        onValueChange={handleChangeSort}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort by date" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="created_desc">Newest first</SelectItem>
                            <SelectItem value="created_asc">Oldest first</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <Select
                        value={statusFilterId}
                        onValueChange={handleChangeStatus}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                    {opt.label}
                                </SelectItem>
                            ))}
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
                        {loading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            <p className="text-sm text-muted-foreground">
                You can horizontally scroll within the left-side of the table to see
                more details.
            </p>

            <div className="h-[600px] border rounded-md overflow-hidden bg-background">
                <MyTransactionsTable
                    rows={rows}
                    loading={loading}
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={handleChangePage}
                    onPageSizeChange={handleChangePageSize}
                    onAfterCancelSubscription={() => {
                        // Re-fetch with current filters/page
                        refresh();
                    }}
                    onAfterRefundRequest={() => {
                        refresh();
                    }}
                />
            </div>
        </div>
    );
}
