import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ColDef,
  GridApi,
  ICellRendererParams,
  ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import { AccountPermissions } from "@/shared/types/AccountPermissions";
import { BaseUserMask, UserLabels } from "@/shared/types/UserInfo";
import { AssignRolesDialog } from "./AssignRolesDialog";
import { recoverRoleArray } from "@/helpers/DataFunctions";
import DetailedUserDialog from "./DetailedUserDialog";

interface UsersTableProps {
  data: BaseUserMask[];
  total: number;
  permData: AccountPermissions[];
  onSave: () => Promise<void>;
  loading?: boolean;

  page: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSortChange?: (field: string, dir: "asc" | "desc") => void;
  onSearchChange?: (field: "name" | "email", term: string) => void;
}

const ActionsCellRenderer = (props: ICellRendererParams<BaseUserMask>) => {
  const { data, context } = props;
  if (!data) return null;

  const { permData, onSave } = context as {
    permData: AccountPermissions[];
    onSave: () => Promise<void>;
  };

  return (
    <div className="flex items-center gap-2">
      <DetailedUserDialog userId={data.uid} onSaved={onSave} />
      <AssignRolesDialog
        userData={data}
        initialRoles={recoverRoleArray(data)}
        permData={permData}
        onSave={onSave}
      />
    </div>
  );
};

export function UsersTable({
  data,
  total,
  permData,
  onSave,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onSearchChange,
}: UsersTableProps) {
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs: ColDef<BaseUserMask>[] = useMemo(
    () => [
      { field: "name", headerName: UserLabels.name, sortable: true, filter: true, flex: 2, minWidth: 150 },
      { field: "email", headerName: UserLabels.email, sortable: true, filter: true, flex: 3, minWidth: 200 },
      { field: "membership", headerName: UserLabels.membership, sortable: true, filter: true, flex: 2, width: 50 },
      { field: "permissions", headerName: UserLabels.permissions, sortable: true, filter: false, flex: 2, minWidth: 150 },
      { field: "uid", headerName: UserLabels.uid, sortable: true, filter: false, flex: 2, minWidth: 200 },
      { headerName: "Actions", cellRenderer: ActionsCellRenderer, sortable: false, filter: false, width: 130 },
    ],
    []
  );

  const defaultColDef: ColDef = useMemo(() => ({ resizable: true }), []);

  const handleSortChanged = (ev: any) => {
    if (!onSortChange) return;
    const state = ev.api.getColumnState();
    const sorted = state.find((c: any) => c.sort != null);
    if (sorted?.colId) {
      onSortChange(sorted.colId, (sorted.sort as "asc" | "desc") ?? "asc");
    } else {
      onSortChange("createdOn", "asc");
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

  return (
    <div className="container mx-start">
      <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
        <AgGridReact
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ permData, onSave }}
          suppressPaginationPanel={true}
          animateRows={true}
          enableCellTextSelection={true}
          onGridReady={(params) => {
            gridApiRef.current = params.api;
          }}
          onSortChanged={handleSortChanged}
          onFilterChanged={handleFilterChanged}
          onPaginationChanged={() => { }}
          suppressScrollOnNewData={true}
          overlayNoRowsTemplate={loading ? "<span></span>" : "<span>No users found</span>"}
        />
      </div>

      <ServerPager
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

function ServerPager({
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div className="text-muted-foreground">
        {loading ? "Loading…" : `Showing ${from}-${to} of ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => onPageChange?.(Math.max(0, page - 1))}
          disabled={loading || !canPrev}
        >
          Prev
        </button>
        <span>
          Page {Math.min(page + 1, totalPages)} of {totalPages}
        </span>
        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => onPageChange?.(Math.min(totalPages - 1, page + 1))}
          disabled={loading || !canNext}
        >
          Next
        </button>

        <select
          className="ml-2 border rounded px-2 py-1"
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
          disabled={loading}
        >
          {[10, 25, 50].map((s) => (
            <option key={s} value={s}>
              {s}/page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default UsersTable;
