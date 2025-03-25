
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
} from "@/components/ui/DataTable"


import {
    permissionLabels
} from "@/types/AccountPermissions"

import { UserPermMask } from "@/types/UserInfo"
import { useState } from "react"


// Explicitly for type safety copy the permissionLabels
var userLabels: Record<string, string> = {
    name: 'Full Name',
    email: 'Email Address',
};
for (const [key, value] of Object.entries(permissionLabels)) {
    if (key !== 'name') {
        userLabels[key] = value;
    }
}

//add Labels for name and email
userLabels['name'] = 'Full Name'
userLabels['email'] = 'Email Address'

interface LogicalUserPermsTableProps {
    data: UserPermMask[]; // Define the expected data type
}


// In the Table, this creates the Columns that display the permissions they have.
const createPermColumn = (accessorKey: keyof UserPermMask): ColumnDef<UserPermMask> => {
    const label = userLabels[accessorKey];

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
                    className={`flex items-center space-x-2 w-full ${accessorKey === "name" || accessorKey === "email" ? "justify-end=" : "justify-center"
                        } text-center`}
                >
                    <div>
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

export const columns: ColumnDef<UserPermMask>[] = [];

Object.keys(userLabels).forEach((key) => {
    columns.push(createPermColumn(key as keyof UserPermMask));
});

export function LogicalUserPermsTable({ data }: LogicalUserPermsTableProps) {
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
                                    if (column.id !== "name" && column.id !== "email") column.toggleVisibility(false);
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
                            .filter((column) => column.getCanHide() && column.id !== "name" && column.id !== "email")
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

export default LogicalUserPermsTable;
