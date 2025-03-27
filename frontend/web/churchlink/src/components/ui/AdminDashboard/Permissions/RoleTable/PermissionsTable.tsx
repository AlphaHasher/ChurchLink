"use client"
import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/DataTable"

import { CreatePermDialog } from "@/components/ui/AdminDashboard/Permissions/RoleTable/CreatePermDialog"
import { EditPermDialog } from "@/components/ui/AdminDashboard/Permissions/RoleTable/EditPermDialog"
import { DeletePermDialog } from "@/components/ui/AdminDashboard/Permissions/RoleTable/DeletePermDialog"

import {
  AccountPermissions, permissionLabels
} from "@/types/AccountPermissions"
import { PermRoleMembersDialog } from "./PermRoleMembersDialog"

import { UserInfo } from "@/types/UserInfo"


interface PermissionsTableProps {
  data: AccountPermissions[]; // Define the expected data type
  userData: UserInfo[];
}

// In the Table, this creates the Columns that display the permissions they have.
const createPermColumn = (
  accessorKey: keyof AccountPermissions,
  userData: UserInfo[]
): ColumnDef<AccountPermissions> => {
  const label = permissionLabels[accessorKey];

  return {
    accessorKey,
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const rowData = row.original; // Access the row data

      return (
        <div
          className={`flex items-center space-x-2 w-full ${accessorKey === "name" ? "justify-end=" : "justify-center"
            } text-center`}
        >
          <div className="capitalize">
            {typeof row.getValue(accessorKey) === "boolean"
              ? row.getValue(accessorKey)
                ? "✅Yes"
                : "❌No"
              : row.getValue(accessorKey)}
          </div>

          {/* Put EditPermDialog and DeletePermDialog */}
          {accessorKey === "name" && (
            <div className="ml-auto flex space-x-2">
              <EditPermDialog permissions={rowData} />
              <DeletePermDialog permissions={rowData} />
              <PermRoleMembersDialog permissions={rowData} userData={userData} />
            </div>
          )}
        </div>
      );
    },
  };
};



export function PermissionsTable({ data, userData }: PermissionsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const columns: ColumnDef<AccountPermissions>[] = [];

  Object.keys(permissionLabels).forEach((key) => {
    columns.push(createPermColumn(key as keyof AccountPermissions, userData));
  });

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="container mx-start">
      <div className="flex items-center py-4">
        {/* Search Input */}
        <Input
          placeholder="Search Permission Name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
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
              onClick={() => {
                table.getAllColumns().forEach((column) => {
                  if (column.id !== "name") column.toggleVisibility(false);
                });
              }}
            >
              Hide All Permissions
            </Button>
            <Button
              variant="outline"
              className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
              onClick={() => {
                table.getAllColumns().forEach((column) => {
                  column.toggleVisibility(true);
                });
              }}
            >
              Show All Permissions
            </Button>

            {table
              .getAllColumns()
              .filter((column) => column.getCanHide() && column.id !== "name")
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) =>
                    column.toggleVisibility(!!value)
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {permissionLabels[column.id as keyof typeof permissionLabels]}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Create Permission Dialog (Aligned Right) */}
        <div className="ml-auto">
          <CreatePermDialog />
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="rounded-md border overflow-x-auto max-w-full">
        <Table className="w-full min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.id === "name" ? "sticky left-0 bg-white z-10 shadow-right" : ""}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === "name" ? "sticky left-0 bg-white z-10 shadow-right" : ""}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-sm text-gray-600">
          {`Showing ${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-${Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )} of ${table.getFilteredRowModel().rows.length}`}
        </div>

        <div className="space-x-2">
          <Button
            className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );


}

export default PermissionsTable;
