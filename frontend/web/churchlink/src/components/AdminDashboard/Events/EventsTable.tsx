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

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/DataTable"

import { useState } from "react"
import { ChurchEvent, eventLabels } from "@/types/ChurchEvent"
import { CreateEventDialog } from "./CreateEventDialog"
import { DeleteEventDialog } from "./DeleteEventDialog"
import { EditEventDialog } from "./EditEventDialog"

interface EventsTableProps {
    data: ChurchEvent[];
    onSave: () => Promise<void>;
}

const skipTerms = ["id", "description", "image_url", "thumbnail_url", "ru_name", "ru_description"];

function getDisplayValue(value: any, key: any): string {
    if (typeof value === "boolean") {
        return value ? "✅Yes" : "❌No";
    }

    if (typeof value === "string") {
        if (key === "date") {
            try {
                const parsedDate = new Date(value);
                if (!isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
                    const day = String(parsedDate.getDate()).padStart(2, "0");
                    return `${year}/${month}/${day}`;
                }
            } catch {
                // fall through
            }
        }
        // Capitalize recurring/gender fields
        if (key === "recurring" || key === "gender") {
            return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        }

        return value;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return "N/A";
        return `[${value.join(", ")}]`;
    }

    if (value === null || value === undefined) {
        return "N/A";
    }

    return String(value);
}

const createPermColumn = (accessorKey: keyof ChurchEvent, onSave: () => Promise<void>): ColumnDef<ChurchEvent> => {
    const label = eventLabels[accessorKey];

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
            const rowData = row.original;
            return (
                <div
                    className={`flex items-center space-x-2 w-full ${accessorKey === "name" ? "justify-end" : "justify-center"} text-center`}
                >
                    <div>
                        {getDisplayValue(row.getValue(accessorKey), accessorKey)}
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

export function EventsTable({ data, onSave }: EventsTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState({});

    const columns: ColumnDef<ChurchEvent>[] = []
    Object.keys(eventLabels).forEach((key) => {
        if (!skipTerms.includes(key)) {
            columns.push(createPermColumn(key as keyof ChurchEvent, onSave))
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