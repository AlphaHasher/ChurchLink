import { useEffect, useRef, useState } from "react";
import MembershipRequestTable from "../components/Users/MembershipRequests/MembershipRequestTable";
import {
    fetchMembershipRequestsPaged,
} from "@/helpers/MembershipHelper";

import { MembershipRequest } from "@/shared/types/MembershipRequests";
import { MembershipSearchParams } from "@/helpers/MembershipHelper";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";

type SortDir = "asc" | "desc";
type SearchField = "name" | "email";
type Status = "pending" | "approved" | "rejected";

const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const ManageMemberships = () => {
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


    useEffect(() => {
        const id = setTimeout(() => setSearchTerm(searchInput), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [searchInput]);

    useEffect(() => {
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
    }, [page, pageSize, searchField, searchTerm, sortDir, status, reload]);

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

                <div className="inline-flex items-center gap-2">
                    <span className="text-sm text-gray-700">Show:</span>
                    <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${status === "pending" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
                        onClick={() => { setStatus("pending"); setPage(0); }}
                    >
                        Pending
                    </button>
                    <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${status === "approved" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
                        onClick={() => { setStatus("approved"); setPage(0); }}
                    >
                        Approved
                    </button>
                    <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${status === "rejected" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
                        onClick={() => { setStatus("rejected"); setPage(0); }}
                    >
                        Rejected
                    </button>
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
