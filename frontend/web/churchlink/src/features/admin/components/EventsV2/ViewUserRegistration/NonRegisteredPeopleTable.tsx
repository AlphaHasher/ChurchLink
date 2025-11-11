import { useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ColDef, GridApi, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import type { AdminEventInstance, PersonDict } from "@/shared/types/Event";

type Row = {
    id: string;
    name: string | null;
    dob: string | null;
    gender: string | null;
    ageOnEvent: number | null;
};

function computeAgeOnEvent(dobISO: string | null, eventDateISO: string | null): number | null {
    if (!dobISO || !eventDateISO) return null;
    const dob = new Date(dobISO);
    const ev = new Date(eventDateISO);
    let age = ev.getFullYear() - dob.getFullYear();
    const m = ev.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && ev.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
}

export default function NonRegisteredPeopleTable({
    instance,
    personDict,
    personIds,
}: {
    instance: AdminEventInstance;
    personDict: PersonDict;
    personIds: string[];
}) {
    const apiRef = useRef<GridApi<Row> | null>(null);

    const rows = useMemo<Row[]>(() => {
        const evDate = instance?.date ?? instance?.event_date ?? null;
        return personIds.map((id) => {
            const pd = personDict[id];
            const first = pd?.first_name ?? "";
            const last = pd?.last_name ?? "";
            const name = (first + " " + last).trim() || null;
            return {
                id,
                name,
                dob: pd?.DOB ?? null,
                gender: pd?.gender ?? null,
                ageOnEvent: computeAgeOnEvent(pd?.DOB ?? null, evDate),
            };
        });
    }, [personIds, personDict, instance?.date, instance?.event_date]);

    const colDefs = useMemo<ColDef<Row>[]>(() => {
        return [
            { headerName: "Name", field: "name", flex: 1.2, minWidth: 180, valueFormatter: (p) => p.value ?? "—" },
            { headerName: "Age on Event", field: "ageOnEvent", flex: 0.6, minWidth: 120, valueFormatter: (p) => p.value ?? "—" },
            {
                headerName: "Date of Birth",
                field: "dob",
                flex: 1,
                minWidth: 160,
                valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString() : "—"),
            },
            { headerName: "Gender", field: "gender", flex: 0.6, minWidth: 110, valueFormatter: (p) => p.value ?? "—" },
            {
                headerName: "Actions",
                pinned: "right",
                minWidth: 120,
                maxWidth: 160,
                cellRenderer: () => <div className="flex items-center justify-end gap-2">{/* reserved */}</div>,
            },
        ];
    }, []);

    const defaultColDef = useMemo<ColDef>(() => {
        return {
            sortable: false,
            resizable: true,
            suppressHeaderMenuButton: true,
        };
    }, []);

    useEffect(() => {
        const api = apiRef.current;
        if (!api) return;
        if (rows.length === 0) api.showNoRowsOverlay();
        else api.hideOverlay();
    }, [rows.length]);

    return (
        <div className="ag-theme-quartz w-full" style={{ display: "flex", flexDirection: "column" }}>
            <AgGridReact<Row>
                rowData={rows}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                domLayout="autoHeight"
                suppressCellFocus
                animateRows
                onGridReady={(ev) => {
                    apiRef.current = ev.api;
                    if (rows.length === 0) ev.api.showNoRowsOverlay();
                    else ev.api.hideOverlay();
                }}
                enableCellTextSelection
                overlayNoRowsTemplate="<span>No people to show.</span>"
            />
        </div>
    );
}
