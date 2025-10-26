import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

import { Input } from "@/shared/components/ui/input"

import { CreatePermDialog } from "@/features/admin/components/Permissions/RoleTable/CreatePermDialog"
import { EditPermDialog } from "@/features/admin/components/Permissions/RoleTable/EditPermDialog"
import { DeletePermDialog } from "@/features/admin/components/Permissions/RoleTable/DeletePermDialog"

import {
  AccountPermissions
} from "@/shared/types/AccountPermissions"
import { PermRoleMembersDialog } from "./PermRoleMembersDialog"

import { getDisplayValue } from "@/helpers/DataFunctions"
import { useState, useRef } from "react"

interface PermissionsTableProps {
  data: AccountPermissions[];
  onSave: () => Promise<void>;
}

// Cell renderer for the actions column
const ActionsCellRenderer = (props: ICellRendererParams<AccountPermissions>) => {
  const { data, context } = props;
  if (!data) return null;

  const { onSave } = context as { onSave: () => Promise<void> };

  return (
    <div className="flex items-center h-full gap-2">
      <PermRoleMembersDialog permissions={data} />
      {data.name !== "Administrator" && (
        <>
          <EditPermDialog permissions={data} onSave={onSave} />
          <DeletePermDialog permissions={data} onSave={onSave} />
        </>
      )}
    </div>
  );
};

export function PermissionsTable({ data, onSave }: PermissionsTableProps) {
  const [quickFilterText, setQuickFilterText] = useState('');
  const gridRef = useRef<AgGridReact<AccountPermissions>>(null);

  const columnDefs: ColDef<AccountPermissions>[] = [
    {
      field: "name",
      headerName: "Permission Role Name",
      sortable: true,
      filter: true,
      flex: 2,
      minWidth: 200,
      valueFormatter: (params) => getDisplayValue(params.value, "name" as any),
      cellClass: "font-medium",
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      flex: 3,
      minWidth: 400,
      suppressSizeToFit: true,
      pinned: 'right',
    },
  ];

  const defaultColDef: ColDef = { resizable: true };

  return (
    <div className="container mx-auto">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search Permission Name..."
          value={quickFilterText}
          onChange={(event) => setQuickFilterText(event.target.value)}
          className="max-w-sm"
        />

        <div className="ml-auto">
          <CreatePermDialog onSave={onSave} />
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ onSave }}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
          animateRows={true}
          enableCellTextSelection={true}
          quickFilterText={quickFilterText}
        />
      </div>
    </div>
  );
}

export default PermissionsTable;
