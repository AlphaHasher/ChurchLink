
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register all community features
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);

import { Button } from "@/shared/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { Input } from "@/shared/components/ui/input"
import { ChevronDown } from "lucide-react"


import { UserPermMask } from "@/shared/types/UserInfo"
import { permissionLabels } from "@/shared/types/AccountPermissions"
import { useState, useMemo, useCallback } from "react"

// Create user-specific labels by extending permission labels
const userLabels: Record<string, string> = {
    name: 'Full Name',
    email: 'Email Address',
    ...permissionLabels,
};

interface LogicalUserPermsTableProps {
    data: UserPermMask[];
}

const BooleanCellRenderer = (props: ICellRendererParams) => {
    const value = props.value;
    if (typeof value === "boolean") {
        return <div className="text-center">{value ? "✅Yes" : "❌No"}</div>;
    }
    return <div className="text-center">{value}</div>;
};

// Generate column definitions dynamically from permission labels
const generateColumnDefs = (): ColDef[] => {
    const columns: ColDef[] = [];

    // Add name column (special case)
    columns.push({
        field: 'name',
        headerName: userLabels.name,
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 150,
        pinned: 'left',
    });

    // Add email column (special case)
    columns.push({
        field: 'email',
        headerName: userLabels.email,
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 200,
    });

    // Generate permission columns dynamically from permissionLabels
    Object.keys(permissionLabels).forEach((permissionKey) => {
        columns.push({
            field: permissionKey,
            headerName: userLabels[permissionKey],
            sortable: true,
            filter: true,
            flex: 1,
            minWidth: 120,
            cellRenderer: BooleanCellRenderer,
        });
    });

    return columns;
};

export function LogicalUserPermsTable({ data }: LogicalUserPermsTableProps) {
    const [gridApi, setGridApi] = useState<any>(null);
    const [columnApi, setColumnApi] = useState<any>(null);

    const columnDefs = useMemo<ColDef[]>(() => generateColumnDefs(), []);

    const defaultColDef: ColDef = {
        resizable: true,
    };

    const onGridReady = useCallback((params: any) => {
        setGridApi(params.api);
        setColumnApi(params.columnApi);
    }, []);

    const hideAllPermissions = useCallback(() => {
        if (columnApi) {
            const columns = columnApi.getColumns();
            columns.forEach((col: any) => {
                // Hide all permission columns except name and email
                if (!['name', 'email'].includes(col.getColId())) {
                    columnApi.setColumnVisible(col.getColId(), false);
                }
            });
        }
    }, [columnApi]);

    const showAllPermissions = useCallback(() => {
        if (columnApi) {
            const columns = columnApi.getColumns();
            columns.forEach((col: any) => {
                columnApi.setColumnVisible(col.getColId(), true);
            });
        }
    }, [columnApi]);

    const toggleColumnVisibility = useCallback((columnId: string, visible: boolean) => {
        if (columnApi) {
            columnApi.setColumnVisible(columnId, visible);
        }
    }, [columnApi]);

    return (
        <div className="container mx-start">
            <div className="flex items-center py-4">
                {/* Search Input */}
                <Input
                    placeholder="Search Name..."
                    onChange={(event) => {
                        if (gridApi) {
                            gridApi.setQuickFilter(event.target.value);
                        }
                    }}
                    className="max-w-sm"
                />

                {/* Permission Focus Dropdown */}
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
                            onClick={hideAllPermissions}
                        >
                            Hide All Permissions
                        </Button>
                        <Button
                            variant="outline"
                            className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
                            onClick={showAllPermissions}
                        >
                            Show All Permissions
                        </Button>

                        {Object.keys(permissionLabels).map((permissionKey) => {
                            const column = columnApi?.getColumn(permissionKey);
                            return (
                                <DropdownMenuCheckboxItem
                                    key={permissionKey}
                                    className="capitalize"
                                    checked={column ? column.isVisible() : true}
                                    onCheckedChange={(value) => toggleColumnVisibility(permissionKey, !!value)}
                                    onSelect={(event) => event.preventDefault()}
                                >
                                    {userLabels[permissionKey]}
                                </DropdownMenuCheckboxItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
                <AgGridReact
                    rowData={data}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onGridReady={onGridReady}
                    pagination={true}
                    paginationPageSize={10}
                    paginationPageSizeSelector={[10, 25, 50]}
                    animateRows={true}
                    enableCellTextSelection={true}
                />
            </div>
        </div>
    );


}

export default LogicalUserPermsTable;
