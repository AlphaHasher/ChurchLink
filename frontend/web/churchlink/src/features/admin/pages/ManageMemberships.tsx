import { useEffect, useRef, useState } from "react";
import MembershipRequestTable from "../components/Users/MembershipRequests/MembershipRequestTable";
import {
    fetchMembershipRequestsPaged,
} from "@/helpers/MembershipHelper";
import useUserPermissions from "@/hooks/useUserPermissions";

import { MembershipRequest } from "@/shared/types/MembershipRequests";
import { MembershipSearchParams } from "@/helpers/MembershipHelper";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";

import { Button } from "@/shared/components/ui/button";

type SortDir = "asc" | "desc";
type SearchField = "name" | "email";
type Status = "pending" | "approved" | "rejected";

const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const ManageMemberships = () => {
    const { permissions, loading: permissionsLoading } = useUserPermissions();

    const [status, setStatus] = useState<Status>("pending");
    const [page, setPage] = useState<number>(0);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [searchField, setSearchField] = useState<SearchField>("name");
    const [searchInput, setSearchInput] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");

    const [rows, setRows] = useState<MembershipRequest[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);

    const [reload, setReload] = useState(0);

    const abortRef = useRef<AbortController | null>(null);

    // Check if user has required permissions
    const hasPermission = permissions?.admin || permissions?.permissions_management;

    useEffect(() => {
        const id = setTimeout(() => setSearchTerm(searchInput), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [searchInput]);

    useEffect(() => {
        // Don't make API calls until permissions are loaded and user has permission
        if (permissionsLoading || !hasPermission) {
            return;
        }

        (async () => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setLoading(true);

            const params: MembershipSearchParams = {
                page,
                pageSize,
                searchField,
                searchTerm,
                sortBy: "created_on",
                sortDir,
                status,
            };

            try {
                const res = await fetchMembershipRequestsPaged(params, controller.signal);
                setRows(res.items || []);
                setTotal(res.total ?? 0);
            } catch (e) {
                console.error("Failed to load membership requests", e);
            } finally {
                setLoading(false);
            }
        })();
    }, [page, pageSize, searchField, searchTerm, sortDir, status, reload, permissionsLoading, hasPermission]);

    const handleSortChange = (_field: string, dir: SortDir) => {
        setSortDir(dir ?? "asc");
        setPage(0);
    };

    const handleSearchChange = (field: "name" | "email", term: string) => {
        setSearchField(field);
        setSearchInput(term);
        setPage(0);
    };

    const refreshAfterUpdate = () => setReload((x) => x + 1);

    // Show loading while permissions are being fetched
    if (permissionsLoading) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold mb-4">Membership Requests</h1>
                <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Loading permissions...</div>
                </div>
            </div>
        );
    }

    // Show error if user doesn't have required permissions
    if (!hasPermission) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold mb-4">Membership Requests</h1>
                <div className="flex items-center justify-center h-32">
                    <div className="text-destructive">You don't have permission to access this page.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 overflow-x-hidden">
            <h1 className="text-xl font-bold mb-4">Membership Requests</h1>

            <div className="flex flex-col gap-2 mb-3">
                <div className="flex gap-2 items-center">
                    <Select
                        value={searchField}
                        onValueChange={(val: "name" | "email") => {
                            setSearchField(val);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Search field" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Search by Name</SelectItem>
                            <SelectItem value="email">Search by Email</SelectItem>
                        </SelectContent>
                    </Select>

                    <input
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                            setPage(0);
                        }}
                        placeholder={`Type to search ${searchField}...`}
                        className="border rounded px-3 py-1 w-80"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show:</span>

                    <div className="inline-flex gap-3 p-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={status === "pending" ? "default" : "outline"}
                            className={`flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-border ${status !== "pending"
                                ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                : ""
                                }`}
                            onClick={() => { setStatus("pending"); setPage(0); }}
                            aria-pressed={status === "pending"}
                        >
                            Pending
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={status === "approved" ? "default" : "outline"}
                            className={`flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-border ${status !== "approved"
                                ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                : ""
                                }`}
                            onClick={() => { setStatus("approved"); setPage(0); }}
                            aria-pressed={status === "approved"}
                        >
                            Approved
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={status === "rejected" ? "default" : "outline"}
                            className={`flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-border ${status !== "rejected"
                                ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                : ""
                                }`}
                            onClick={() => { setStatus("rejected"); setPage(0); }}
                            aria-pressed={status === "rejected"}
                        >
                            Rejected
                        </Button>
                    </div>
                </div>
            </div>

            <MembershipRequestTable
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
                onSearchChange={handleSearchChange}
                onSave={refreshAfterUpdate}
            />
        </div>
    );
};

export default ManageMemberships;
