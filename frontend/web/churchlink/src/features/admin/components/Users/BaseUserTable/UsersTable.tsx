import { useEffect, useMemo, useRef } from "react";
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

interface UsersTableProps {
  data: BaseUserMask[];
  permData: AccountPermissions[];
  onSave: () => Promise<void>;

  // server plumbing (paging/sort/search)
  loading?: boolean;
  page?: number;
  pageSize?: number;
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
    <AssignRolesDialog
      userData={data}
      initialRoles={recoverRoleArray(data)}
      permData={permData}
      onSave={onSave}
    />
  );
};

export function UsersTable({
  data,
  permData,
  onSave,
  loading,
  page = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  onSortChange,

  onSearchChange,
}: UsersTableProps) {
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs: ColDef<BaseUserMask>[] = useMemo(
    () => [
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
        flex: 3,
        minWidth: 200,
      },
      {
        field: "dateOfBirth",
        headerName: UserLabels.dateOfBirth,
        sortable: true,
        filter: false,
        flex: 1,
        minWidth: 120,
      },
      {
        field: "permissions",
        headerName: UserLabels.permissions,
        sortable: true,
        filter: false,
        flex: 2,
        minWidth: 150,
      },
      {
        field: "uid",
        headerName: UserLabels.uid,
        sortable: true,
        filter: false,
        flex: 2,
        minWidth: 200,
      },
      {
        headerName: "Actions",
        cellRenderer: ActionsCellRenderer,
        sortable: false,
        filter: false,
        width: 100,
        suppressSizeToFit: true,
      },
    ],
    []
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      resizable: true,
    }),
    []
  );

  // Server sort bridge
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

  // Server pagination bridge while showing AG Grid’s footer UI
  const handlePaginationChanged = () => {
    const api = gridApiRef.current;
    if (!api) return;

    const currentPage = api.paginationGetCurrentPage(); // zero-based
    const currentSize = api.paginationGetPageSize();

    if (onPageSizeChange && currentSize !== pageSize) onPageSizeChange(currentSize);
    if (onPageChange && currentPage !== page) onPageChange(currentPage);
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

    // Fallback: pick one if present; otherwise clear search.
    if (nameModel?.filter) {
      onSearchChange("name", nameModel.filter);
    } else if (emailModel?.filter) {
      onSearchChange("email", emailModel.filter);
    } else {
      onSearchChange("name", "");
    }
  };

  // keep grid UI synced when parent changes page/size
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

  return (
    <div className="container mx-start">
      <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
        <AgGridReact
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ permData, onSave }}

          pagination={true}
          paginationPageSize={pageSize}
          paginationPageSizeSelector={[10, 25, 50]}
          animateRows={true}
          enableCellTextSelection={true}

          onGridReady={(params) => {
            gridApiRef.current = params.api;
            const api = params.api as any;
            api.setGridOption?.("paginationPageSize", pageSize);
            api.paginationGoToPage?.(page);
          }}
          onPaginationChanged={handlePaginationChanged}
          onSortChanged={handleSortChanged}
          onFilterChanged={handleFilterChanged}

          suppressScrollOnNewData={true}
          overlayNoRowsTemplate={loading ? "<span></span>" : "<span>No users found</span>"}
        />
      </div>
    </div>
  );
}

export default UsersTable;
