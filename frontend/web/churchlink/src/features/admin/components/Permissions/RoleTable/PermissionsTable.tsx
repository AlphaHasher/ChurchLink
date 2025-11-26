import { useRef, useState } from "react";
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  ModuleRegistry,
  ClientSideRowModelModule,
  PaginationModule,
  RowSelectionModule
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  PaginationModule,
  RowSelectionModule
]);

import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";

import { CreatePermDialog } from "@/features/admin/components/Permissions/RoleTable/CreatePermDialog";
import { EditPermDialog } from "@/features/admin/components/Permissions/RoleTable/EditPermDialog";
import { DeletePermDialog } from "@/features/admin/components/Permissions/RoleTable/DeletePermDialog";

import {
  AccountPermissions,
  permissionLabels
} from "@/shared/types/AccountPermissions";
import { PermRoleMembersDialog } from "./PermRoleMembersDialog";

import { getDisplayValue } from "@/helpers/DataFunctions";

// Helper function to get accessible permissions for a role
const getAccessiblePermissions = (permissions: AccountPermissions): string => {
  const accessiblePerms: string[] = [];
  
  // Check each permission field and add to list if true
  Object.entries(permissions).forEach(([key, value]) => {
    if (key !== '_id' && key !== 'name' && value === true) {
      // Convert snake_case to readable format
      const label = permissionLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      accessiblePerms.push(label);
    }
  });
  
  if (accessiblePerms.length === 0) {
    return "No permissions";
  }
  
  // Show first few permissions and indicate if there are more
  if (accessiblePerms.length <= 3) {
    return accessiblePerms.join(', ');
  } else {
    return `${accessiblePerms.slice(0, 3).join(', ')} +${accessiblePerms.length - 3} more`;
  }
};

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
  const gridOptions = {};

  const columnDefs: ColDef<AccountPermissions>[] = [
    {
      field: "name",
      headerName: "Permission Role Name",
      sortable: true,
      filter: true,
      flex: 2,
      minWidth: 200,
      valueFormatter: (params) => getDisplayValue(params.value, "name" as any),
      cellRenderer: (props: ICellRendererParams<AccountPermissions>) => {
        const { data } = props;
        if (!data) return null;
        return (
          <div className="flex items-center gap-2 w-full min-w-0">
            <span className="font-medium truncate" title={data.name}>{data.name}</span>
          </div>
        );
      },
    },
    {
      headerName: "Accessible Pages/Permissions",
      sortable: false,
      filter: true,
      flex: 3,
      minWidth: 300,
      valueGetter: (params) => {
        if (!params.data) return "";
        return getAccessiblePermissions(params.data);
      },
      cellRenderer: (props: ICellRendererParams<AccountPermissions>) => {
        const { data } = props;
        if (!data) return null;
        const permsText = getAccessiblePermissions(data);
        const accessiblePerms: string[] = [];
        Object.entries(data).forEach(([key, value]) => {
          if (key !== '_id' && key !== 'name' && value === true) {
            const label = permissionLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            accessiblePerms.push(label);
          }
        });
        const fullText = accessiblePerms.length > 0 ? accessiblePerms.join(', ') : "No permissions";
        
        return (
          <div className="text-sm text-muted-foreground" title={fullText}>
            {permsText}
          </div>
        );
      },
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      flex: 2.5,
      minWidth: 420,
      cellStyle: { display: 'flex', alignItems: 'center', height: '100%' },
      pinned: 'right',
    },
  ];

  const defaultColDef: ColDef = {
    resizable: true,
  };

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search Permission Name or Accessible Pages..."
          value={quickFilterText}
          onChange={(event) => setQuickFilterText(event.target.value)}
          className="max-w-sm"
        />

        <div className="ml-auto flex items-center gap-3">
          <Button onClick={() => onSave()}>Refresh</Button>
          <CreatePermDialog onSave={onSave} />
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          context={{ onSave }}
          pagination={true}
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50]}
          animateRows={true}
          enableCellTextSelection={true}
          quickFilterText={quickFilterText}
        />
      </div>
    </div>
  );
}

export default PermissionsTable;
