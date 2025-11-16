// ViewAdminTransactions.tsx
// Admin-facing page to view transactions across all users.

import { useEffect, useRef, useState } from "react";

import AdminTransactionsTable from "@/features/admin/components/FinanceV2/Transactions/AdminTransactionsTable";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

import {
    adminSearchTransactions,
} from "@/helpers/TransactionsHelper";

import type {
    TransactionKind,
    TransactionSortMode,
    AdminTransactionsResults,
    AdminTransactionSearchParams,
} from "@/shared/types/Transactions";

import {
    getStatusFilterOptionsForKind,
} from "@/features/transactions/MyTransactionsFormatting";

const ALL_KIND = "all";
type KindFilter = typeof ALL_KIND | TransactionKind;

const DEFAULT_PAGE_SIZE = 25;

export default function ViewAdminTransactions() {
    const [kindFilter, setKindFilter] = useState<KindFilter>(ALL_KIND);
    const [sort, setSort] = useState<TransactionSortMode>("created_desc");
    const [statusFilterId, setStatusFilterId] = useState<string>("all");

    // Admin-only filters
    const [userUid, setUserUid] = useState("");
    const [orderId, setOrderId] = useState("");
    const [captureId, setCaptureId] = useState("");
    const [subId, setSubId] = useState("");
    const [eventId, setEventId] = useState("");
    const [eventInstanceId, setEventInstanceId] = useState("");
    const [formId, setFormId] = useState("");

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [results, setResults] = useState<AdminTransactionsResults | null>(null);
    const [loading, setLoading] = useState(false);

    // Avoid race conditions when rapidly changing filters
    const requestIdRef = useRef(0);

    const kinds: TransactionKind[] | undefined =
        kindFilter === ALL_KIND ? undefined : [kindFilter];

    // Status options for the current kind
    const kindForStatus = kindFilter === ALL_KIND ? "all" : kindFilter;
    const statusOptions = getStatusFilterOptionsForKind(kindForStatus);
    const selectedStatus =
        statusOptions.find((o) => o.id === statusFilterId) ?? statusOptions[0];
    const statuses =
        selectedStatus && selectedStatus.id !== "all"
            ? selectedStatus.statuses
            : undefined;

    const total =
        results?.counts?.total_fetched ??
        (results?.items?.length ?? 0);

    const refresh = async (overrides: Partial<AdminTransactionSearchParams> = {}) => {
        const currentRequestId = ++requestIdRef.current;
        setLoading(true);

        const baseParams: AdminTransactionSearchParams = {
            kinds,
            sort,
            page,
            page_size: pageSize,
            statuses,
            paypal_order_id: orderId || undefined,
            paypal_capture_id: captureId || undefined,
            paypal_subscription_id: subId || undefined,
            user_uid: userUid || undefined,
            event_id: eventId || undefined,
            event_instance_id: eventInstanceId || undefined,
            form_id: formId || undefined,
        };

        const params: AdminTransactionSearchParams = {
            ...baseParams,
            ...overrides,
        };

        try {
            const data = await adminSearchTransactions(params);
            // simple “last write wins” guard
            if (requestIdRef.current === currentRequestId) {
                setResults(data);
            }
        } catch (err) {
            console.error("[ViewAdminTransactions] refresh() error", err);
            if (requestIdRef.current === currentRequestId) {
                setResults(null);
            }
        } finally {
            if (requestIdRef.current === currentRequestId) {
                setLoading(false);
            }
        }
    };

    const resetToFirstPage = (cb: () => void) => {
        setPage(1);
        cb();
    };

    // Initial load
    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApplyFilters = () => {
        setPage(1);
        refresh({ page: 1 });
    };

    const handleClearFilters = () => {
        setKindFilter(ALL_KIND);
        setSort("created_desc");
        setStatusFilterId("all");
        setUserUid("");
        setOrderId("");
        setCaptureId("");
        setSubId("");
        setEventId("");
        setEventInstanceId("");
        setFormId("");
        setPage(1);
        setPageSize(DEFAULT_PAGE_SIZE);
        refresh({
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
            kinds: undefined,
            statuses: undefined,
            paypal_order_id: undefined,
            paypal_capture_id: undefined,
            paypal_subscription_id: undefined,
            user_uid: undefined,
            event_id: undefined,
            event_instance_id: undefined,
            form_id: undefined,
        });
    };

    const rows = results?.items ?? [];

    return (
        <div className="p-6 overflow-x-hidden">
            <h1 className="text-xl font-bold mb-4">Transactions (Admin)</h1>

            {/* Filters */}
            <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-wrap gap-3 items-end">
                    {/* Type */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Type</span>
                        <Select
                            value={kindFilter}
                            onValueChange={(v) =>
                                resetToFirstPage(() => {
                                    setKindFilter(v as KindFilter);
                                    setStatusFilterId("all");
                                })
                            }
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

                    {/* Sort */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Sort</span>
                        <Select
                            value={sort}
                            onValueChange={(v) =>
                                resetToFirstPage(() =>
                                    setSort(v as TransactionSortMode)
                                )
                            }
                            disabled={loading}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sort" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="created_desc">Newest first</SelectItem>
                                <SelectItem value="created_asc">Oldest first</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Status</span>
                        <Select
                            value={statusFilterId}
                            onValueChange={(v) => setStatusFilterId(v)}
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

                    {/* User UID */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">User UID</span>
                        <Input
                            className="w-[220px]"
                            value={userUid}
                            onChange={(e) => setUserUid(e.target.value)}
                            placeholder="Filter by user uid"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleClearFilters}
                            disabled={loading}
                        >
                            Clear
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApplyFilters}
                            disabled={loading}
                        >
                            {loading ? "Searching..." : "Search"}
                        </Button>
                    </div>
                </div>

                {/* Second row: PayPal + context filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                            PayPal Order ID
                        </span>
                        <Input
                            className="w-[220px]"
                            value={orderId}
                            onChange={(e) => setOrderId(e.target.value)}
                            placeholder="Exact order id"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                            Capture ID
                        </span>
                        <Input
                            className="w-[220px]"
                            value={captureId}
                            onChange={(e) => setCaptureId(e.target.value)}
                            placeholder="Capture / sale id"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                            Subscription ID
                        </span>
                        <Input
                            className="w-[220px]"
                            value={subId}
                            onChange={(e) => setSubId(e.target.value)}
                            placeholder="Plan subscription id"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Event ID</span>
                        <Input
                            className="w-[180px]"
                            value={eventId}
                            onChange={(e) => setEventId(e.target.value)}
                            placeholder="event_id"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                            Event Instance ID
                        </span>
                        <Input
                            className="w-[200px]"
                            value={eventInstanceId}
                            onChange={(e) => setEventInstanceId(e.target.value)}
                            placeholder="event_instance_id"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Form ID</span>
                        <Input
                            className="w-[180px]"
                            value={formId}
                            onChange={(e) => setFormId(e.target.value)}
                            placeholder="form_id"
                            disabled={loading}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="h-[600px] border rounded-md overflow-hidden bg-background">
                <AdminTransactionsTable
                    rows={rows}
                    loading={loading}
                    page={results?.page ?? page}
                    pageSize={results?.page_size ?? pageSize}
                    total={total}
                    onPageChange={(p) => {
                        setPage(p);
                        refresh({ page: p });
                    }}
                    onPageSizeChange={(s) => {
                        setPage(1);
                        setPageSize(s);
                        refresh({ page: 1, page_size: s });
                    }}
                    onAfterRefund={() => {
                        // Preserve current filters/page; just re-fetch
                        refresh();
                    }}
                />
            </div>
        </div>
    );
}
