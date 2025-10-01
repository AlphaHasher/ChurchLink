import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register all community features
ModuleRegistry.registerModules([AllCommunityModule]);

import { ChevronDown } from "lucide-react"
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register all community features
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

import { UserInfo } from "@/shared/types/UserInfo"
import { getDisplayValue } from "@/helpers/DataFunctions"
import { useState, useRef, useEffect } from "react"
import { updateRole } from "@/helpers/PermissionsHelper"
import { Checkbox } from "@/shared/components/ui/checkbox"
import MultiStateBadge from "@/shared/components/MultiStageBadge"
import { useState, useRef, useEffect } from "react"
import { updateRole } from "@/helpers/PermissionsHelper"
import { Checkbox } from "@/shared/components/ui/checkbox"
import MultiStateBadge from "@/shared/components/MultiStageBadge"


interface PermissionsTableProps {
  data: AccountPermissions[];
  data: AccountPermissions[];
  userData: UserInfo[];
  onSave: () => Promise<void>;
}

// Cell renderer for the actions column
const ActionsCellRenderer = (props: ICellRendererParams<AccountPermissions>) => {
  const { data, context } = props;
  if (!data) return null;

  const { userData, permData, onSave } = context as {
    userData: UserInfo[],
    permData: AccountPermissions[],
    onSave: () => Promise<void>
  };
// Cell renderer for the actions column
const ActionsCellRenderer = (props: ICellRendererParams<AccountPermissions>) => {
  const { data, context } = props;
  if (!data) return null;

  const { userData, permData, onSave } = context as {
    userData: UserInfo[],
    permData: AccountPermissions[],
    onSave: () => Promise<void>
  };

  return (
    <div className="flex space-x-2">
      {data.name !== "Administrator" && (
        <>
          <EditPermDialog permissions={data} onSave={onSave} />
          <DeletePermDialog permissions={data} onSave={onSave} />
        </>
      )}
      <PermRoleMembersDialog permissions={data} userData={userData} permData={permData} />
    </div>
  );
};

// Cell renderer for permission columns
const PermissionCellRenderer = (props: ICellRendererParams<AccountPermissions> & { permissionKey: keyof AccountPermissions }) => {
  const { data, value, permissionKey, context } = props;
  if (!data) return null;

  const { onSave } = context as { onSave: () => Promise<void> };
  const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

  const isDisabled = data.name === "Administrator" || badgeState !== "custom";

  const handleTogglePermission = async (checked: boolean) => {
    if (data.name === "Administrator") return; // Don't allow toggling Administrator permissions

    setBadgeState("processing");

    try {
      const updatedRole = {
        ...data,
        [permissionKey]: checked
      };

      const result = await updateRole(updatedRole);
      if (result) {
        setBadgeState("success");
        // Hold success for visibility, then refresh data and return to custom
        setTimeout(async () => {
          await onSave();
          setBadgeState("custom");
        }, 900);
      } else {
        setBadgeState("error");
        // Hold error for visibility
        setTimeout(() => setBadgeState("custom"), 1200);
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      setBadgeState("error");
      setTimeout(() => setBadgeState("custom"), 1200);
    } finally {
      // no-op; badgeState handles visual state
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full overflow-visible">
      {(() => {
        return (
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
        );
      })()}
    </div>
  );
  return (
    <div className="flex space-x-2">
      {data.name !== "Administrator" && (
        <>
          <EditPermDialog permissions={data} onSave={onSave} />
          <DeletePermDialog permissions={data} onSave={onSave} />
        </>
      )}
      <PermRoleMembersDialog permissions={data} userData={userData} permData={permData} />
    </div>
  );
};

// Cell renderer for permission columns
const PermissionCellRenderer = (props: ICellRendererParams<AccountPermissions> & { permissionKey: keyof AccountPermissions }) => {
  const { data, value, permissionKey, context } = props;
  if (!data) return null;

  const { onSave } = context as { onSave: () => Promise<void> };
  const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

  const isDisabled = data.name === "Administrator" || badgeState !== "custom";

  const handleTogglePermission = async (checked: boolean) => {
    if (data.name === "Administrator") return; // Don't allow toggling Administrator permissions

    setBadgeState("processing");

    try {
      const updatedRole = {
        ...data,
        [permissionKey]: checked
      };

      const result = await updateRole(updatedRole);
      if (result) {
        setBadgeState("success");
        // Hold success for visibility, then refresh data and return to custom
        setTimeout(async () => {
          await onSave();
          setBadgeState("custom");
        }, 900);
      } else {
        setBadgeState("error");
        // Hold error for visibility
        setTimeout(() => setBadgeState("custom"), 1200);
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      setBadgeState("error");
      setTimeout(() => setBadgeState("custom"), 1200);
    } finally {
      // no-op; badgeState handles visual state
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full overflow-visible">
      {(() => {
        return (
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
        );
      })()}
    </div>
  );
};



export function PermissionsTable({ data, userData, onSave }: PermissionsTableProps) {
  const [quickFilterText, setQuickFilterText] = useState('');
  const gridRef = useRef<AgGridReact<AccountPermissions>>(null);

  // Initialize column visibility state - show all columns by default, load from localStorage if available
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const savedState = localStorage.getItem('permissions-table-column-visibility');
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.warn('Failed to parse saved column visibility state:', e);
      }
    }

    // Default: all columns visible
    const initialState: Record<string, boolean> = {};
    Object.keys(permissionLabels).forEach((key) => {
      initialState[key] = true;
    });
    initialState.Actions = true; // Actions column is always visible
    return initialState;
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('permissions-table-column-visibility', JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  // Create column definitions dynamically from permissionLabels
  const columnDefs: ColDef<AccountPermissions>[] = Object.keys(permissionLabels).map((key) => {
    const permissionKey = key as keyof AccountPermissions;

    if (permissionKey === 'name') {
      return {
        field: permissionKey,
        headerName: permissionLabels[permissionKey],
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 150,
        valueFormatter: (params) => getDisplayValue(params.value, permissionKey),
        cellClass: 'font-medium',
        hide: !columnVisibility[permissionKey],
      };
    } else {
      // Permission columns use the custom cell renderer
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
      };
    }
  });

  // Add actions column
  columnDefs.push({
    headerName: 'Actions',
    cellRenderer: ActionsCellRenderer,
    sortable: false,
    filter: false,
    width: 200,
    suppressSizeToFit: true,
    pinned: 'right',
    hide: false,
  });

  const defaultColDef: ColDef = {
    resizable: true,
  };

  const handleHideAllPermissions = () => {
    const newVisibility = { ...columnVisibility };
    Object.keys(permissionLabels).forEach((key) => {
      newVisibility[key] = false;
    });
    newVisibility.name = true; // Keep name column visible
    newVisibility.Actions = true; // Keep actions column visible
    setColumnVisibility(newVisibility);
  };

  const handleShowAllPermissions = () => {
    const newVisibility = { ...columnVisibility };
    Object.keys(permissionLabels).forEach((key) => {
      newVisibility[key] = true;
    });
    newVisibility.Actions = true; // Keep actions column visible
    setColumnVisibility(newVisibility);
  };

  const handleColumnVisibilityChange = (columnId: string, visible: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: visible,
    }));
  };
  const [quickFilterText, setQuickFilterText] = useState('');
  const gridRef = useRef<AgGridReact<AccountPermissions>>(null);

  // Initialize column visibility state - show all columns by default, load from localStorage if available
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const savedState = localStorage.getItem('permissions-table-column-visibility');
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.warn('Failed to parse saved column visibility state:', e);
      }
    }

    // Default: all columns visible
    const initialState: Record<string, boolean> = {};
    Object.keys(permissionLabels).forEach((key) => {
      initialState[key] = true;
    });
    initialState.Actions = true; // Actions column is always visible
    return initialState;
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('permissions-table-column-visibility', JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  // Create column definitions dynamically from permissionLabels
  const columnDefs: ColDef<AccountPermissions>[] = Object.keys(permissionLabels).map((key) => {
    const permissionKey = key as keyof AccountPermissions;

    if (permissionKey === 'name') {
      return {
        field: permissionKey,
        headerName: permissionLabels[permissionKey],
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 150,
        valueFormatter: (params) => getDisplayValue(params.value, permissionKey),
        cellClass: 'font-medium',
        hide: !columnVisibility[permissionKey],
      };
    } else {
      // Permission columns use the custom cell renderer
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
      };
    }
  });

  // Add actions column
  columnDefs.push({
    headerName: 'Actions',
    cellRenderer: ActionsCellRenderer,
    sortable: false,
    filter: false,
    width: 200,
    suppressSizeToFit: true,
    pinned: 'right',
    hide: false,
  });

  const defaultColDef: ColDef = {
    resizable: true,
  };

  const handleHideAllPermissions = () => {
    const newVisibility = { ...columnVisibility };
    Object.keys(permissionLabels).forEach((key) => {
      newVisibility[key] = false;
    });
    newVisibility.name = true; // Keep name column visible
    newVisibility.Actions = true; // Keep actions column visible
    setColumnVisibility(newVisibility);
  };

  const handleShowAllPermissions = () => {
    const newVisibility = { ...columnVisibility };
    Object.keys(permissionLabels).forEach((key) => {
      newVisibility[key] = true;
    });
    newVisibility.Actions = true; // Keep actions column visible
    setColumnVisibility(newVisibility);
  };

  const handleColumnVisibilityChange = (columnId: string, visible: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: visible,
    }));
  };

  return (
    <div className="container mx-start">
      <div className="flex items-center py-4">
        {/* Search Input */}
        <Input
          placeholder="Search Permission Name..."
          value={quickFilterText}
          onChange={(event) => setQuickFilterText(event.target.value)}
          value={quickFilterText}
          onChange={(event) => setQuickFilterText(event.target.value)}
          className="max-w-sm"
        />

        {/* Permission Focus Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-4 !bg-background">
              Permission Focus <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Button
              variant="outline"
              className="!bg-background text-foreground border border-border shadow-sm hover:bg-muted"
              onClick={handleHideAllPermissions}
            >
              Hide All Permissions
            </Button>
            <Button
              variant="outline"
              className="!bg-background text-foreground border border-border shadow-sm hover:bg-muted"
              onClick={handleShowAllPermissions}
            >
              Show All Permissions
            </Button>

            {Object.keys(permissionLabels)
              .filter((key) => key !== 'name')
              .map((key) => (
            {Object.keys(permissionLabels)
              .filter((key) => key !== 'name')
              .map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  key={key}
                  className="capitalize"
                  checked={columnVisibility[key] ?? false}
                  checked={columnVisibility[key] ?? false}
                  onCheckedChange={(value) =>
                    handleColumnVisibilityChange(key, !!value)
                    handleColumnVisibilityChange(key, !!value)
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {permissionLabels[key as keyof typeof permissionLabels]}
                  {permissionLabels[key as keyof typeof permissionLabels]}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Create Permission Dialog (Aligned Right) */}
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
          context={{ userData, permData: data, onSave }}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
          animateRows={true}
          enableCellTextSelection={true}
          quickFilterText={quickFilterText}
        />
      <div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          key={JSON.stringify(columnVisibility)}
          ref={gridRef}
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ userData, permData: data, onSave }}
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
