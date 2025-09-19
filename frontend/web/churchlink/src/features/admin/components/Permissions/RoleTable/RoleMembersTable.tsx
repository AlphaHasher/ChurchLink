
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
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/DataTable"


import { PermRoleMemberMask, RoleMembersLabels } from "@/shared/types/UserInfo"
import { useState } from "react"


interface RoleMembersTableProps {
  data: PermRoleMemberMask[]; // Define the expected data type
}

// In the Table, this creates the Columns that display the permissions they have.
const createColumn = (accessorKey: keyof PermRoleMemberMask): ColumnDef<PermRoleMemberMask> => {
  const label = RoleMembersLabels[accessorKey];

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

      return (
        <div
          className={`flex items-center space-x-2 w-full "justify-center"
            text-center`}
        >
          <div>
            {row.getValue(accessorKey)}
          </div>
        </div>
      );
    },
  };
};

export const columns: ColumnDef<PermRoleMemberMask>[] = [];

Object.keys(RoleMembersLabels).forEach((key) => {
  columns.push(createColumn(key as keyof PermRoleMemberMask));
});

export function RoleMembersTable({ data }: RoleMembersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

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
          placeholder="Search Name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
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

export default RoleMembersTable;