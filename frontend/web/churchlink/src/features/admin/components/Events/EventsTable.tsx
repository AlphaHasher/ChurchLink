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

import { useState } from "react"
import { ChurchEvent, eventLabels } from "@/shared/types/ChurchEvent"
import { CreateEventDialog } from "./CreateEventDialog"
import { DeleteEventDialog } from "./DeleteEventDialog"
import { EditEventDialog } from "./EditEventDialog"
import { getDisplayValue, roleIdListToRoleStringList } from "@/helpers/DataFunctions"
import { AccountPermissions } from "@/shared/types/AccountPermissions"

interface EventsTableProps {
    data: ChurchEvent[];
    permData: AccountPermissions[];
    onSave: () => Promise<void>;
}

const skipTerms = ["id", "description", "image_url", "thumbnail_url", "ru_name", "ru_description"];


const createPermColumn = (accessorKey: keyof ChurchEvent, onSave: () => Promise<void>, permData: AccountPermissions[]): ColumnDef<ChurchEvent> => {
    const label = eventLabels[accessorKey];

    return {
        accessorKey,
        header: ({ column }) => (
            <div className={`flex items-center space-x-2 w-full ${accessorKey === "name" ? "justify-start" : "justify-center"
                } text-center`}>
                <Button
                    variant="ghost"
                    className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    {label}
                    <ArrowUpDown />
                </Button>
            </div>

        ),
        cell: ({ row }) => {
            const rowData = row.original;
            return (
                <div
                    className={`flex items-center space-x-2 w-full ${accessorKey === "name" ? "justify-end" : "justify-center"
                        } text-center`}
                >
                    <div>
                        {accessorKey === 'roles' ? getDisplayValue(roleIdListToRoleStringList(permData, row.getValue(accessorKey)), accessorKey) : getDisplayValue(row.getValue(accessorKey), accessorKey)}
                    </div>
                    {accessorKey === "name" && (
                        <div className="ml-auto flex space-x-2">
                            <EditEventDialog event={rowData} onSave={onSave} />
                            <DeleteEventDialog event={rowData} onSave={onSave} />
                        </div>
                    )}
                </div>
            )
        },
    }
}

export function EventsTable({ data, permData, onSave }: EventsTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState({});

    const columns: ColumnDef<ChurchEvent>[] = []
    Object.keys(eventLabels).forEach((key) => {
        if (!skipTerms.includes(key)) {
            columns.push(createPermColumn(key as keyof ChurchEvent, onSave, permData))
        }
    })

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
                <Input
                    placeholder="Search Name..."
                    value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                        table.getColumn("name")?.setFilterValue(event.target.value)
                    }
                    className="max-w-sm"
                />
                <div className="ml-auto">
                    <CreateEventDialog onSave={onSave} />
                </div>
            </div>

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

export default EventsTable;