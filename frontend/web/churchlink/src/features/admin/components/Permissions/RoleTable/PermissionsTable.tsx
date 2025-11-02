import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

import { Input } from "@/shared/components/ui/input"

import { CreatePermDialog } from "@/features/admin/components/Permissions/RoleTable/CreatePermDialog"
import { EditPermDialog } from "@/features/admin/components/Permissions/RoleTable/EditPermDialog"
import { DeletePermDialog } from "@/features/admin/components/Permissions/RoleTable/DeletePermDialog"

import {
  AccountPermissions,
  permissionLabels
} from "@/shared/types/AccountPermissions"
import { PermRoleMembersDialog } from "./PermRoleMembersDialog"

import { getDisplayValue } from "@/helpers/DataFunctions"
import { useState, useRef } from "react"

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
      headerName: "Accessible Pages/Permissions",
      sortable: false,
      filter: true,
      flex: 3,
      minWidth: 300,
      valueGetter: (params) => {
        if (!params.data) return "";
        return getAccessiblePermissions(params.data);
      },
      cellClass: "text-sm text-gray-600",
      tooltipValueGetter: (params) => {
        if (!params.data) return "";
        // Show full list in tooltip
        const accessiblePerms: string[] = [];
        Object.entries(params.data).forEach(([key, value]) => {
          if (key !== '_id' && key !== 'name' && value === true) {
            const label = permissionLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            accessiblePerms.push(label);
          }
        });
        return accessiblePerms.length > 0 ? accessiblePerms.join(', ') : "No permissions";
      },
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      flex: 2,
      minWidth: 300,
      suppressSizeToFit: true,
      pinned: 'right',
    },
  ];

  const defaultColDef: ColDef = { resizable: true };

  return (
    <div className="container mx-auto">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search Permission Name or Accessible Pages..."
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
          tooltipShowDelay={500}
        />
      </div>
    </div>
  );
}

export default PermissionsTable;
