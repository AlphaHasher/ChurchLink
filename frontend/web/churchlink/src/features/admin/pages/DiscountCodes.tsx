import { useEffect, useMemo, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import type { DiscountCode } from "@/shared/types/Event";
import { fetchAllDiscountCodes } from "@/helpers/EventManagementHelper";

import CreateDiscountCodeDialog from "@/features/admin/components/EventsV2/DiscountCodes/CreateDiscountCodeDialog";
import DiscountCodesTable from "@/features/admin/components/EventsV2/DiscountCodes/DiscountCodesTable";

export default function DiscountCodes() {
    const [rows, setRows] = useState<DiscountCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const refresh = async () => {
        setLoading(true);
        try {
            const data = await fetchAllDiscountCodes();
            setRows(data ?? []);
        } catch (err) {
            console.error("Failed to fetch discount codes", err);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    // Client-side filter (code + name + id)
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            const hay = `${r.code} ${r.name} ${r.id}`.toLowerCase();
            return hay.includes(q);
        });
    }, [rows, query]);

    useEffect(() => {
        setPage(1);
    }, [query]);

    return (
        <div className="flex flex-col gap-4 p-6 overflow-x-hidden">
            <h1 className="text-xl font-bold mb-4">Discount Codes</h1>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <Input
                    className="w-[320px]"
                    placeholder="Search by code, name, or ID…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                />
                <div className="ml-auto">
                    <CreateDiscountCodeDialog onCreated={refresh} />
                </div>
            </div>

            {/* Table */}
            <div style={{ height: "70vh" }}>
                <DiscountCodesTable
                    rows={filtered}
                    loading={loading}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => {
                        setPage(1);
                        setPageSize(s);
                    }}
                    onEdited={refresh}
                />
            </div>
        </div>
    );
}
