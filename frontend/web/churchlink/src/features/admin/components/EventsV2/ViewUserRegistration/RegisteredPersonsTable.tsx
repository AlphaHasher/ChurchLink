import { useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ColDef, GridApi, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import type { AdminEventInstance, RegistrationDetails, PersonDict } from "@/shared/types/Event";
import AdminForceUnregistrationDialog from "./AdminForceUnregistrationDialog";

type Row = {
    id: string; // "SELF" or person _id
    name: string | null;
    dob: string | null;
    gender: string | null;
    ageOnEvent: number | null;

    paymentType: "paypal" | "door" | "free" | null;
    price: number | null;
    paymentComplete: boolean | null;
    discountCode: string | null; // show NO CODE USED if null
    orderId: string | null; // transaction id
    lineId: string | null;
    is_forced: boolean | null;
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

function formatForced(v?: boolean | null) {
    if (v === undefined || v === null) return "UNKNOWN";
    return v ? "Admin" : "User";
}

export default function RegisteredPersonsTable({
    instance,
    reg,
    personDict,
    personIds,
    userId,
}: {
    instance: AdminEventInstance;
    reg: RegistrationDetails | null;
    personDict: PersonDict;
    personIds: string[];
    userId: string;
}) {
    const apiRef = useRef<GridApi<Row> | null>(null);

    const rows = useMemo<Row[]>(() => {
        if (!reg) return [];
        const evDate = instance?.date ?? instance?.event_date ?? null;

        const toRow = (id: string, pd: any, pay: any | null): Row => {
            const first = pd?.first_name ?? "";
            const last = pd?.last_name ?? "";
            const name = (first + " " + last).trim() || null;

            // tolerate several possible backend keys
            const discountCode =
                pay?.discount_code_id ?? pay?.discount_code ?? pay?.discountCodeId ?? pay?.discountCode ?? null;
            const orderId = pay?.order_id ?? pay?.transaction_id ?? pay?.capture_id ?? null;
            const lineId = pay?.line_id ?? pay?.lineId ?? null;

            const is_forced = pay?.is_forced ?? null;

            return {
                id,
                name,
                dob: pd?.DOB ?? null,
                gender: pd?.gender ?? null,
                ageOnEvent: computeAgeOnEvent(pd?.DOB ?? null, evDate),

                paymentType: (pay?.payment_type as any) ?? null,
                price: typeof pay?.price === "number" ? pay.price : null,
                paymentComplete: typeof pay?.payment_complete === "boolean" ? pay.payment_complete : null,
                discountCode: discountCode ?? null,
                orderId: orderId ?? null,
                lineId: lineId ?? null,
                is_forced: is_forced ?? null,
            };
        };

        const out: Row[] = [];
        for (const id of personIds) {
            if (id === "SELF") {
                const pd = personDict["SELF"];
                const pay = reg.self_registered ? reg.self_payment_details : null;
                out.push(toRow("SELF", pd, pay));
            } else {
                const pd = personDict[id];
                const pay = (reg.family_registered || []).includes(id) ? reg.family_payment_details?.[id] ?? null : null;
                out.push(toRow(id, pd, pay));
            }
        }
        return out;
    }, [personIds, personDict, reg, instance?.date, instance?.event_date]);

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

            // Payment breakdown columns
            {
                headerName: "Payment Type",
                field: "paymentType",
                flex: 0.8,
                minWidth: 130,
                valueFormatter: (p) => (p.value ? (p.value === "door" ? "Pay at door" : p.value === "paypal" ? "PayPal" : "Free") : "—"),
            },
            {
                headerName: "Price",
                field: "price",
                flex: 0.7,
                minWidth: 110,
                valueFormatter: (p) => (typeof p.value === "number" ? `$${p.value.toFixed(2)}` : "$0.00"),
            },
            {
                headerName: "Payment Complete",
                field: "paymentComplete",
                flex: 0.9,
                minWidth: 150,
                cellRenderer: (p: any) => {
                    const v = p?.data?.paymentComplete;
                    if (v === true) {
                        return (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                                Paid
                            </span>
                        );
                    }
                    if (v === false) {
                        return (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-rose-50 text-rose-700">
                                Not Paid
                            </span>
                        );
                    }
                    return "—";
                },
            },
            {
                headerName: "Discount Code",
                field: "discountCode",
                flex: 1,
                minWidth: 150,
                valueFormatter: (p) => (p.value ? String(p.value) : "NO CODE USED"),
            },
            {
                headerName: "Transaction ID",
                field: "orderId",
                flex: 1,
                minWidth: 170,
                valueFormatter: (p) => (p.value ? String(p.value) : "NONE"),
            },
            {
                headerName: "Line ID",
                field: "lineId",
                flex: 1,
                minWidth: 150,
                valueFormatter: (p) => (p.value ? String(p.value) : "NONE"),
            },

            {
                headerName: "Registered By",
                field: "is_forced",
                flex: 1,
                minWidth: 120,
                cellDataType: "text",
                valueGetter: (p) => formatForced(p.data?.is_forced),
            },

            {
                headerName: "Actions",
                pinned: "right",
                minWidth: 120,
                maxWidth: 160,
                cellRenderer: (p: any) => {
                    const row = p?.data as Row | null;
                    if (!row) return null;
                    const id = row.id as "SELF" | string;
                    // Inline render to have access to props.instance/personDict/userId
                    // Lazy import (optional), but simple direct import works too:
                    // import AdminForceUnregistrationDialog at top of file
                    return (
                        <div className="flex items-center justify-end gap-2">
                            <AdminForceUnregistrationDialog
                                instance={instance}
                                userId={userId}
                                personId={id}
                                personDict={personDict}
                            />
                        </div>
                    );
                },
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
                overlayNoRowsTemplate="<span>No registered people.</span>"
            />
        </div>
    );
}
