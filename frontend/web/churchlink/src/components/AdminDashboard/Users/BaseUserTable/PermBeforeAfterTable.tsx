"use client"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/DataTable"

import { PermComp, PermCompLabels } from "@/types/AccountPermissions"


interface PermBeforeAfterTableProps {
  data: PermComp[];
}

// In the Table, this creates the Columns that display the permissions they have.
const createPermColumn = (
  accessorKey: keyof PermComp,
): ColumnDef<PermComp> => {
  const label = PermCompLabels[accessorKey];

  return {
    accessorKey,
    header: () => (
      <Button
        variant="ghost"
        className="!bg-white text-black border border-gray-300 shadow-sm pointer-events-none hover:!bg-white"
        disabled
      >
        {label}
      </Button>
    ),
    cell: ({ row }) => {

      return (
        <div
          className={`flex items-center space-x-2 w-full justify-center
           text-center`}
        >
          <div className="capitalize">
            {typeof row.getValue(accessorKey) === "boolean"
              ? row.getValue(accessorKey)
                ? "✅Yes"
                : "❌No"
              : row.getValue(accessorKey)}
          </div>
        </div>
      );
    },
  };
};



export function PermBeforeAfterTable({ data }: PermBeforeAfterTableProps) {

  const columns: ColumnDef<PermComp>[] = [];

  Object.keys(PermCompLabels).forEach((key) => {
    columns.push(createPermColumn(key as keyof PermComp));
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="container mx-start">
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
    </div>
  );


}

export default PermBeforeAfterTable;
