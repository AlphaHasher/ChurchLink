import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

import { ChevronDown } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { Input } from "@/shared/components/ui/input"

import { CreatePermDialog } from "@/features/admin/components/Permissions/RoleTable/CreatePermDialog"
import { EditPermDialog } from "@/features/admin/components/Permissions/RoleTable/EditPermDialog"
import { DeletePermDialog } from "@/features/admin/components/Permissions/RoleTable/DeletePermDialog"

import {
  AccountPermissions, permissionLabels
} from "@/shared/types/AccountPermissions"
import { PermRoleMembersDialog } from "./PermRoleMembersDialog"

import { getDisplayValue } from "@/helpers/DataFunctions"
import { useState, useRef, useEffect } from "react"
import { updateRole } from "@/helpers/PermissionsHelper"
import { Checkbox } from "@/shared/components/ui/checkbox"
import MultiStateBadge from "@/shared/components/MultiStageBadge"

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
    <div className="flex space-x-2">
      {data.name !== "Administrator" && (
        <>
          <EditPermDialog permissions={data} onSave={onSave} />
          <DeletePermDialog permissions={data} onSave={onSave} />
        </>
      )}
      <PermRoleMembersDialog permissions={data} />
    </div>
  );
};

// Cell renderer for permission columns
const PermissionCellRenderer = (
  props: ICellRendererParams<AccountPermissions> & { permissionKey: keyof AccountPermissions }
) => {
  const { data, value, permissionKey, context } = props;
  if (!data) return null;

  const { onSave } = context as { onSave: () => Promise<void> };
  const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

  const isDisabled = data.name === "Administrator" || badgeState !== "custom";

  const handleTogglePermission = async (checked: boolean) => {
    if (data.name === "Administrator") return;

    setBadgeState("processing");
    try {
      const updatedRole = { ...data, [permissionKey]: checked };
      const result = await updateRole(updatedRole);
      if (result) {
        setBadgeState("success");
        setTimeout(async () => {
          await onSave();
          setBadgeState("custom");
        }, 900);
      } else {
        setBadgeState("error");
        setTimeout(() => setBadgeState("custom"), 1200);
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      setBadgeState("error");
      setTimeout(() => setBadgeState("custom"), 1200);
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full overflow-visible">
      <MultiStateBadge
        state={badgeState}
        customComponent={
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(v) => handleTogglePermission(v === true)}
            disabled={isDisabled}
          />
        }
      />
    </div>
  );
};

export function PermissionsTable({ data, onSave }: PermissionsTableProps) {
  const [quickFilterText, setQuickFilterText] = useState('');
  const gridRef = useRef<AgGridReact<AccountPermissions>>(null);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const savedState = localStorage.getItem('permissions-table-column-visibility');
    if (savedState) {
      try { return JSON.parse(savedState); } catch (err) { console.error("Failed to parse permissions-table-column-visibility from localStorage:", err); }
    }
    const initialState: Record<string, boolean> = {};
    Object.keys(permissionLabels).forEach((key) => { initialState[key] = true; });
    initialState.name = true;
    initialState.Actions = true;
    return initialState;
  });

  useEffect(() => {
    localStorage.setItem('permissions-table-column-visibility', JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const columnDefs: ColDef<AccountPermissions>[] = [
    {
      field: "name",
      headerName: "Permission Role Name",
      sortable: true,
      filter: true,
      flex: 2,
      minWidth: 180,
      valueFormatter: (params) => getDisplayValue(params.value, "name" as any),
      cellClass: "font-medium",
      hide: !columnVisibility["name"],
    },
    ...Object.keys(permissionLabels).map((key) => {
      const permissionKey = key as keyof AccountPermissions;
      return {
        field: permissionKey,
        headerName: permissionLabels[permissionKey],
        sortable: true,
        filter: true,
        flex: 1,
        minWidth: 100,
        cellClass: 'perm-cell',
        cellStyle: { display: 'grid', placeItems: 'center', padding: 0 },
        cellRenderer: (props: ICellRendererParams<AccountPermissions>) =>
          PermissionCellRenderer({ ...props, permissionKey }),
        hide: !columnVisibility[permissionKey],
      } as ColDef<AccountPermissions>;
    }),
    {
      headerName: 'Actions',
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      width: 200,
      suppressSizeToFit: true,
      pinned: 'right',
      hide: false,
    },
  ];

  const defaultColDef: ColDef = { resizable: true };

  const handleHideAllPermissions = () => {
    const next = { ...columnVisibility };
    Object.keys(permissionLabels).forEach((key) => { next[key] = false; });
    next.name = true;
    next.Actions = true;
    setColumnVisibility(next);
  };

  const handleShowAllPermissions = () => {
    const next = { ...columnVisibility };
    Object.keys(permissionLabels).forEach((key) => { next[key] = true; });
    next.Actions = true;
    setColumnVisibility(next);
  };

  const handleColumnVisibilityChange = (columnId: string, visible: boolean) => {
    setColumnVisibility(prev => ({ ...prev, [columnId]: visible }));
  };

  return (
    <div className="container mx-start">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search Permission Name..."
          value={quickFilterText}
          onChange={(event) => setQuickFilterText(event.target.value)}
          className="max-w-sm"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-4 !bg-white">
              Permission Focus <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Button
              variant="outline"
              className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
              onClick={handleHideAllPermissions}
            >
              Hide All Permissions
            </Button>
            <Button
              variant="outline"
              className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
              onClick={handleShowAllPermissions}
            >
              Show All Permissions
            </Button>

            {/* allow toggling any permission column */}
            {["name", ...Object.keys(permissionLabels)].map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                className="capitalize"
                checked={columnVisibility[key] ?? false}
                onCheckedChange={(value) => handleColumnVisibilityChange(key, !!value)}
                onSelect={(event) => event.preventDefault()}
              >
                {key === "name" ? "Permission Role Name" : permissionLabels[key as keyof typeof permissionLabels]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto">
          <CreatePermDialog onSave={onSave} />
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          key={JSON.stringify(columnVisibility)}
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
