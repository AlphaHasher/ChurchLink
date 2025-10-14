import { useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ColDef,
  ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import { PermRoleMemberMask, RoleMembersLabels } from "@/shared/types/UserInfo";

interface RoleMembersTableProps {
  data: PermRoleMemberMask[];
  loading?: boolean;
}

const RoleMembersTable = ({ data, loading }: RoleMembersTableProps) => {
  const gridRef = useRef<AgGridReact<PermRoleMemberMask>>(null);
  const pageSize = 10;

  const columns: ColDef<PermRoleMemberMask>[] = useMemo(
    () => [
      {
        field: "name",
        headerName: RoleMembersLabels.name,
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 160,
      },
      {
        field: "email",
        headerName: RoleMembersLabels.email,
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 220,
      },
    ],
    []
  );

  const defaultColDef: ColDef = useMemo(() => ({ resizable: true }), []);

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    if (loading) {
      api.showLoadingOverlay();
    } else if (!data || data.length === 0) {
      api.showNoRowsOverlay();
    } else {
      api.hideOverlay();
    }
  }, [loading, data?.length]);

  return (
    <div className="ag-theme-quartz" style={{ height: 400, width: "100%" }}>
      <AgGridReact
        ref={gridRef}
        rowData={data}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        pagination={true}
        paginationPageSize={pageSize}
        paginationPageSizeSelector={[10, 25, 50]}
        animateRows={true}
        enableCellTextSelection={true}
        overlayLoadingTemplate="<span>Loading…</span>"
        overlayNoRowsTemplate="<span>No results.</span>"
        onGridReady={(params) => {
          const api = params.api as any;
          api.setGridOption?.("paginationPageSize", pageSize);
          if (loading) {
            api.showLoadingOverlay();
          } else if (!data || data.length === 0) {
            api.showNoRowsOverlay();
          }
        }}
      />
    </div>
  );
};

export default RoleMembersTable;
