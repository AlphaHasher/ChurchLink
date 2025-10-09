import { useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    AllCommunityModule,
    ColDef,
    GridApi,
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
    const gridApiRef = useRef<GridApi | null>(null);

    const dynamicPermColumns: ColDef[] = useMemo(() => {
        if (!data?.length) return [];
        const first: Record<string, unknown> = data[0] as any;

        const excluded = new Set(["name", "email", "uid", "id", "_id", "Id", "ID"]);
        const permKeys = Object.keys(first).filter((k) => {
            if (excluded.has(k)) return false;
            const v = (first as any)[k];
            return typeof v === "boolean";
        });

        return permKeys.map<ColDef>((key) => ({
            field: key,
            headerName: key.split("_").join(" ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
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
                minWidth: 200,
            },
            ...dynamicPermColumns,
        ];
    }, [dynamicPermColumns]);

    const handleSort = (ev: any) => {
        const state = ev.api.getColumnState();
        const sorted = state.find((c: any) => c.sort != null);
        if (sorted && sorted.colId) {
            onSortChange(sorted.colId, (sorted.sort as "asc" | "desc") ?? "asc");
        } else {
            onSortChange("name", "asc");
        }
    };

    const handlePaginationChanged = () => {
        const api = gridApiRef.current;
        if (!api) return;

        const currentPage = api.paginationGetCurrentPage();
        const currentSize = api.paginationGetPageSize();

        if (currentSize !== pageSize) onPageSizeChange(currentSize);
        if (currentPage !== page) onPageChange(currentPage);
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

        if (nameModel?.filter) {
            onSearchChange("name", nameModel.filter);
        } else if (emailModel?.filter) {
            onSearchChange("email", emailModel.filter);
        } else {
            onSearchChange("name", "");
        }
    };

    useEffect(() => {
        const api = gridApiRef.current as any;
        if (!api) return;

        if (api.paginationGetPageSize() !== pageSize) {
            api.setGridOption("paginationPageSize", pageSize);
        }
        if (api.paginationGetCurrentPage() !== page) {
            api.paginationGoToPage(page);
        }
    }, [page, pageSize]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="container mx-start">
            <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
                <AgGridReact
                    rowData={data}
                    columnDefs={columns}
                    defaultColDef={{ resizable: true }}
                    pagination={true}
                    paginationPageSize={pageSize}
                    paginationPageSizeSelector={[10, 25, 50, 100]}
                    animateRows={true}
                    enableCellTextSelection={true}

                    onGridReady={(params) => {
                        gridApiRef.current = params.api;
                        const api = params.api as any;
                        api.setGridOption?.("paginationPageSize", pageSize);
                        api.paginationGoToPage?.(page);
                    }}
                    onPaginationChanged={handlePaginationChanged}
                    onSortChanged={handleSort}
                    onFilterChanged={handleFilterChanged}

                    suppressScrollOnNewData={true}
                    overlayNoRowsTemplate={loading ? "<span></span>" : "<span>No users with roles found</span>"}
                />
            </div>

            <div className="flex items-center justify-between py-2 text-sm">
                <div className="text-muted-foreground">
                    {loading ? "Loading…" : `Showing ${data.length} of ${total} users with roles`}
                </div>
                <div>
                    Page {page + 1} / {totalPages}
                </div>
            </div>
        </div>
    );
};

export default LogicalUserPermsTable;
