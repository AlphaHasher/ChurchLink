import { useState, useRef, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { ClientSideRowModelModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ChurchEvent, eventLabels } from "@/shared/types/ChurchEvent";
import { CreateEventDialog } from "./CreateEventDialog";
import { DeleteEventDialog } from "./DeleteEventDialog";
import { EditEventDialog } from "./EditEventDialog";
import { getDisplayValue, roleIdListToRoleStringList } from "@/helpers/DataFunctions";
import { AccountPermissions } from "@/shared/types/AccountPermissions";

interface EventsTableProps {
    data: ChurchEvent[];
    permData: AccountPermissions[];
    onSave: () => Promise<void>;
}

const skipTerms = ["id", "description", "image_url", "thumbnail_url", "ru_name", "ru_description"];

export function EventsTable({ data, permData, onSave }: EventsTableProps) {
    const gridRef = useRef<AgGridReact>(null);
    const [searchValue, setSearchValue] = useState("");
    const [isFirstPage, setIsFirstPage] = useState(true);
    const [isLastPage, setIsLastPage] = useState(false);
    const [currentPageNum, setCurrentPageNum] = useState(1);

    const columnDefs = useMemo(() => {
        const nameCol: any = {
            field: "name",
            headerName: eventLabels.name,
            pinned: "left",
            sortable: true,
            filter: true,
            flex: 1,
            minWidth: 150,
            cellStyle: {
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block"
            }
        };

        const actionsCol: any = {
            headerName: "Actions",
            pinned: "right",
            cellRenderer: (params: any) => {
                const rowData = params.data as ChurchEvent;
                return (
                    <div className="flex items-center space-x-2 justify-end">
                        <EditEventDialog event={rowData} onSave={onSave} />
                        <DeleteEventDialog event={rowData} onSave={onSave} />
                    </div>
                );
            },
            sortable: false,
            filter: false,
            width: 120,
            suppressSizeToFit: true
        };

        const restCols = Object.keys(eventLabels)
            .filter((key) => key !== "name" && !skipTerms.includes(key))
            .map((key) => {
                const field = key as keyof ChurchEvent;
                const headerName = eventLabels[field];
                const colDef: any = {
                    field,
                    headerName,
                    sortable: true,
                    filter: true,
                    width: 150,
                };

                if (field === "roles") {
                    colDef.valueGetter = (params: any) => {
                        const roles = roleIdListToRoleStringList(permData, params.data.roles);
                        return getDisplayValue(roles, field);
                    };
                } else {
                    colDef.cellRenderer = (params: any) => getDisplayValue(params.value, field);
                }

                return colDef;
            });

        return [nameCol, actionsCol, ...restCols];
    }, [permData, onSave]);

    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
        floatingFilter: false,
    }), []);

    const onGridReady = useCallback((params: any) => {
        if (searchValue) {
            (params.api as any).setQuickFilter(searchValue);
        }
        setIsFirstPage(params.api.isFirstPage());
        setIsLastPage(params.api.isLastPage());
        setCurrentPageNum(params.api.paginationGetCurrentPage() + 1);
    }, [searchValue]);

    const handlePaginationChanged = useCallback((params: any) => {
        const api = params.api;
        setIsFirstPage(api.isFirstPage());
        setIsLastPage(api.isLastPage());
        setCurrentPageNum(api.paginationGetCurrentPage() + 1);
    }, []);

    const onSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setSearchValue(value);
        if (gridRef.current?.api) {
            (gridRef.current.api as any).setQuickFilter(value);
        }
    }, []);

    const paginationOptions = {
        suppressPaginationPanel: true,
        pagination: true,
        paginationPageSize: 10,
        rowBuffer: 10,
    };

    return (
        <div className="container mx-auto">
            <div className="flex items-center py-4">
                <Input
                    placeholder="Search Events..."
                    value={searchValue}
                    onChange={onSearchChange}
                    className="max-w-sm"
                />
                <div className="ml-auto">
                    <CreateEventDialog onSave={onSave} />
                </div>
            </div>

            <div className="ag-theme-quartz h-[500px] w-full border border-border rounded-md">
                <AgGridReact
                    ref={gridRef}
                    rowData={data}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    modules={[ClientSideRowModelModule]}
                    onGridReady={onGridReady}
                    onPaginationChanged={handlePaginationChanged}
                    {...paginationOptions}
                    suppressRowClickSelection={true}
                    animateRows={true}
                />
            </div>

            {/* Custom Pagination */}
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    Showing {((currentPageNum - 1) * 10 + 1)} to {Math.min(currentPageNum * 10, data.length)} of {data.length} events
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => gridRef.current?.api?.paginationGoToFirstPage()}
                        disabled={isFirstPage}
                    >
                        First
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => gridRef.current?.api?.paginationGoToPreviousPage()}
                        disabled={isFirstPage}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => gridRef.current?.api?.paginationGoToNextPage()}
                        disabled={isLastPage}
                    >
                        Next
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => gridRef.current?.api?.paginationGoToLastPage()}
                        disabled={isLastPage}
                    >
                        Last
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default EventsTable;