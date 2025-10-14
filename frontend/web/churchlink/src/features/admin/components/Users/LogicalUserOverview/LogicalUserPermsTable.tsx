import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    AllCommunityModule,
    ColDef,
    ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import { UserPermMask, UserLabels } from "@/shared/types/UserInfo";

interface LogicalUserPermsTableProps {
    data: UserPermMask[];
    loading: boolean;
    total: number;

    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onSortChange: (field: string, dir: "asc" | "desc") => void;

    onSearchChange?: (field: "name" | "email", term: string) => void;
}

const LogicalUserPermsTable = ({
    data,
    loading,
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onSearchChange,
}: LogicalUserPermsTableProps) => {
    const dynamicPermColumns: ColDef[] = useMemo(() => {
        if (!data?.length) return [];
        const first = data[0] as Record<string, unknown>;

        const excluded = new Set(["name", "email", "uid", "id", "_id", "Id", "ID"]);
        const permKeys = Object.keys(first).filter((k) => {
            if (excluded.has(k)) return false;
            return typeof first[k] === "boolean";
        });

        return permKeys.map<ColDef>((key) => ({
            field: key,
            headerName: key
                .split("_")
                .join(" ")
                .replace(/\b\w/g, (c: string) => c.toUpperCase()),
            sortable: false,
            filter: false,
            flex: 1,
            minWidth: 160,
            valueFormatter: (p) => (p.value ? "✅Yes" : "❌No"),
        }));
    }, [data]);

    const columns: ColDef[] = useMemo(() => {
        return [
            {
                field: "name",
                headerName: UserLabels.name,
                sortable: true,
                filter: true,
                flex: 2,
                minWidth: 150,
            },
            {
                field: "email",
                headerName: UserLabels.email,
                sortable: true,
                filter: true,
                flex: 2,
                minWidth: 220,
            },
            ...dynamicPermColumns,
        ];
    }, [dynamicPermColumns]);

    const handleSort = (ev: any) => {
        const state = ev.api.getColumnState();
        const sorted = state.find((c: any) => c.sort != null);
        if (sorted?.colId) {
            onSortChange(sorted.colId, (sorted.sort as "asc" | "desc") ?? "asc");
        } else {
            onSortChange("name", "asc");
        }
    };

    const handleFilterChanged = (ev: any) => {
        if (!onSearchChange) return;
        const model = ev.api.getFilterModel?.() || {};
        const nameModel = model["name"];
        const emailModel = model["email"];

        const lastChangedColId = ev.column?.getColId?.();
        if (lastChangedColId === "name" && nameModel) {
            onSearchChange("name", nameModel.filter ?? "");
            return;
        }
        if (lastChangedColId === "email" && emailModel) {
            onSearchChange("email", emailModel.filter ?? "");
            return;
        }

        if (nameModel?.filter) onSearchChange("name", nameModel.filter);
        else if (emailModel?.filter) onSearchChange("email", emailModel.filter);
        else onSearchChange("name", "");
    };

    const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
    const canPrev = page > 0;
    const canNext = page + 1 < totalPages;
    const from = total === 0 ? 0 : page * pageSize + 1;
    const to = Math.min((page + 1) * pageSize, total);

    return (
        <div className="container mx-start">
            <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
                <AgGridReact
                    rowData={data}
                    columnDefs={columns}
                    defaultColDef={{ resizable: true }}
                    suppressPaginationPanel={true}
                    animateRows={true}
                    enableCellTextSelection={true}
                    onSortChanged={handleSort}
                    onFilterChanged={handleFilterChanged}
                    onPaginationChanged={() => { }}
                    suppressScrollOnNewData={true}
                    overlayNoRowsTemplate={
                        loading ? "<span></span>" : "<span>No users with roles found</span>"
                    }
                />
            </div>

            <div className="flex items-center justify-between py-2 text-sm">
                <div className="text-muted-foreground">
                    {loading ? "Loading…" : `Showing ${from}-${to} of ${total} users with roles`}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => onPageChange(Math.max(0, page - 1))}
                        disabled={loading || !canPrev}
                    >
                        Prev
                    </button>
                    <span>
                        Page {Math.min(page + 1, totalPages)} of {totalPages}
                    </span>
                    <button
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                        disabled={loading || !canNext}
                    >
                        Next
                    </button>

                    <select
                        className="ml-2 border rounded px-2 py-1"
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
                        disabled={loading}
                    >
                        {[10, 25, 50, 100].map((s) => (
                            <option key={s} value={s}>
                                {s}/page
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default LogicalUserPermsTable;
