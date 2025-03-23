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
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
} from "@/components/ui/AdminDashboard/BaseTable"

const data: AccountPermissions[] = [
  {
    name: "Administrator",
    isAdmin: true,
    manageWholeSite: true,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Youth Ministry",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: false,
    editAllPages: false,
    accessFinances: false,
    manageNotifications: false,
    manageMediaContent: true,
    manageUserPermissions: false,
    manageBiblePlan: false,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
  {
    name: "Moderator",
    isAdmin: false,
    manageWholeSite: false,
    editAllEvents: true,
    editAllPages: true,
    accessFinances: true,
    manageNotifications: true,
    manageMediaContent: true,
    manageUserPermissions: true,
    manageBiblePlan: true,
  },
];


export type AccountPermissions = {
  name: string;
  isAdmin: boolean;
  manageWholeSite: boolean;
  editAllEvents: boolean;
  editAllPages: boolean;
  accessFinances: boolean;
  manageNotifications: boolean;
  manageMediaContent: boolean;
  manageBiblePlan: boolean;
  manageUserPermissions: boolean;
}

const permissionLabels: Record<string, string> = {
  name: "Permission Name",
  isAdmin: "Administrator",
  manageWholeSite: "Site Management",
  editAllEvents: "Event Moderator",
  editAllPages: "Page Moderator",
  accessFinances: "Financial Access",
  manageNotifications: "Notification Management",
  manageMediaContent: "Manage Media Content",
  manageBiblePlan: "Manage Bible Plan",
  manageUserPermissions: "Manage User Permissions",
};


const createPermColumn = (accessorKey: keyof AccountPermissions, isBool: boolean): ColumnDef<AccountPermissions> => {
  const label = permissionLabels[accessorKey]; // Assign label before the return

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
    cell: ({ row }) => (
      <div className="capitalize">
        {isBool ? (row.getValue(accessorKey) ? "✅Yes" : "❌No") : row.getValue(accessorKey)}
      </div>
    ),
  };
};


export const columns: ColumnDef<AccountPermissions>[] = [
  createPermColumn("name", false),
  createPermColumn("isAdmin", true),
  createPermColumn("manageWholeSite", true),
  createPermColumn("editAllEvents", true),
  createPermColumn("editAllPages", true),
  createPermColumn("accessFinances", true),
  createPermColumn("manageNotifications", true),
  createPermColumn("manageMediaContent", true),
  createPermColumn("manageBiblePlan", true),
  createPermColumn("manageUserPermissions", true),
  
  //Good example for drop down menu, wanna save this for later
  /*{
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))

      // Format the amount as a dollar amount
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount)

      return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const perm = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
            >
              Copy payment ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View customer</DropdownMenuItem>
            <DropdownMenuItem>View payment details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },*/
]

export function DataTableDemo() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

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
  })

  return (
    <div className="w-full max-w-6xl overflow-x-auto">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search Permission Name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto !bg-white">
              Permission Focus <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Container for buttons with horizontal spacing */}
            <div className="flex space-x-2 mb-3">
              {/* Hide All Permissions Button */}
              <Button
                variant="outline"
                className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
                onClick={() => {
                  // Hide all
                  table.getAllColumns().forEach((column) => {
                    if (column.id !== "name") column.toggleVisibility(false);
                  });
                }}
              >
                Hide All Permissions
              </Button>

              {/* Show All Permissions Button */}
              <Button
                variant="outline"
                className="!bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
                onClick={() => {
                  // Show all columns by setting their visibility to true
                  table.getAllColumns().forEach((column) => {
                    column.toggleVisibility(true);
                  });
                }}
              >
                Show All Permissions
              </Button>
            </div>

            {/* Columns List */}
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide() && column.id !== "name")
              .map((column) => {
                // Get the human-readable label from permissionLabels
                const label = permissionLabels[column.id as keyof typeof permissionLabels];

                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {label} {/* Display the value (human-readable label) */}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>


      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        {/* Pagination Text */}
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
  )
}


export default DataTableDemo;