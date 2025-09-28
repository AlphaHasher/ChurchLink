
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register all community features
ModuleRegistry.registerModules([AllCommunityModule]);

import { AccountPermissions } from "@/shared/types/AccountPermissions"
import { BaseUserMask, UserLabels } from "@/shared/types/UserInfo"
import { AssignRolesDialog } from "./AssignRolesDialog"
import { recoverRoleArray } from "@/helpers/DataFunctions"

interface UsersTableProps {
  data: BaseUserMask[];
  permData: AccountPermissions[];
  onSave: () => Promise<void>;
}

const ActionsCellRenderer = (props: ICellRendererParams<BaseUserMask>) => {
  const { data, context } = props;
  if (!data) return null;

  const { permData, onSave } = context as { permData: AccountPermissions[], onSave: () => Promise<void> };

  return (
    <AssignRolesDialog
      userData={data}
      initialRoles={recoverRoleArray(data)}
      permData={permData}
      onSave={onSave}
    />
  );
};

export function UsersTable({ data, permData, onSave }: UsersTableProps) {
  const columnDefs: ColDef<BaseUserMask>[] = [
    {
      field: 'name',
      headerName: UserLabels.name,
      sortable: true,
      filter: true,
      flex: 2,
      minWidth: 150,
    },
    {
      field: 'email',
      headerName: UserLabels.email,
      sortable: true,
      filter: true,
      flex: 3,
      minWidth: 200,
    },
    {
      field: 'dateOfBirth',
      headerName: UserLabels.dateOfBirth,
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'permissions',
      headerName: UserLabels.permissions,
      sortable: true,
      filter: true,
      flex: 2,
      minWidth: 150,
    },
    {
      field: 'uid',
      headerName: UserLabels.uid,
      sortable: true,
      filter: true,
      flex: 2,
      minWidth: 200,
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      width: 100,
      suppressSizeToFit: true,
    },
  ];

  const defaultColDef: ColDef = {
    resizable: true,
  };

  return (
    <div className="container mx-start">
      <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
        <AgGridReact
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{ permData, onSave }}
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

export default UsersTable;
