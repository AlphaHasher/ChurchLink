import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/shared/components/ui/popover";
import {
    Command,
    CommandInput,
    CommandEmpty,
    CommandList,
    CommandGroup,
    CommandItem,
} from "@/shared/components/ui/command";

import EventInstancesTable from "../components/EventsV2/InstanceManagement/EventInstancesTable";
import {
    fetchAdminPanelEventById,
    fetchPagedAdminPanelEventInstances,
} from "@/helpers/EventManagementHelper";
import { localizationNameToCode } from "@/shared/dictionaries/LocalizationDicts";

type StatusOpt = "all" | "upcoming" | "passed";

const DEFAULT_PAGE_SIZE = 25;

export default function EventInstances() {
    const navigate = useNavigate();
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams] = useSearchParams();

    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);

    const [status, setStatus] = useState<StatusOpt>("all");
    const [sortBySeriesIndexAsc, setSortBySeriesIndexAsc] = useState<boolean>(true);

    const languageDisplayNames = useMemo(
        () => Object.keys(localizationNameToCode).sort((a, b) => a.localeCompare(b)),
        []
    );
    const searchPreferredLang = searchParams.get("preferred_lang") || "en";
    const initialPreferredLangName =
        Object.entries(localizationNameToCode).find(
            ([, code]) => code === searchPreferredLang
        )?.[0] ||
        Object.entries(localizationNameToCode).find(([, code]) => code === "en")?.[0] ||
        languageDisplayNames[0] ||
        "English";

    const [preferredLangName, setPreferredLangName] = useState<string>(
        initialPreferredLangName
    );

    const [event, setEvent] = useState<any | null>(null);

    const requestSeqRef = useRef(0);

    const refresh = async (
        overrides?: Partial<{
            page: number;
            limit: number;
            status: StatusOpt;
            sort_by_series_index_asc: boolean;
        }>
    ) => {
        if (!eventId) return;
        const seq = ++requestSeqRef.current;
        const preferredLangCode = localizationNameToCode[preferredLangName] || "en";

        setLoading(true);
        try {
            const [evt, instances] = await Promise.all([
                fetchAdminPanelEventById(eventId, preferredLangCode),
                fetchPagedAdminPanelEventInstances({
                    event_id: eventId,
                    page: overrides?.page ?? page,
                    limit: overrides?.limit ?? pageSize,
                    status: overrides?.status ?? status,
                    sort_by_series_index_asc:
                        overrides?.sort_by_series_index_asc ?? sortBySeriesIndexAsc,
                    preferred_lang: preferredLangCode,
                }),
            ]);

            if (seq !== requestSeqRef.current) return;

            setEvent(evt ?? null);
            setRows(instances.items ?? []);
            setTotal(instances.total ?? 0);
            setPages(instances.pages ?? 0);
        } catch (e) {
            if (seq !== requestSeqRef.current) return;
            console.error("Failed to load instances", e);
            setEvent(null);
            setRows([]);
            setTotal(0);
            setPages(0);
        } finally {
            if (seq === requestSeqRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [eventId]);

    useEffect(() => {
        refresh();
    }, [page, pageSize, status, sortBySeriesIndexAsc, preferredLangName]);

    // Set the title string depending on if event has loaded or not
    const headerTitle = event?.default_title
        ? `Event Instances for Event - ${event.default_title}`
        : `Event Instances for Event`;

    return (
        <div className="flex flex-col gap-4 p-6 overflow-x-hidden">
            <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => navigate("/admin/events")}>
                    ← Back to Events
                </Button>
                <h1 className="text-xl font-bold">{headerTitle}</h1>
            </div>

            {/* Quick bar: status toggle + language */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2">
                    <span className="text-sm text-gray-700">Show:</span>
                    <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${status === "all"
                            ? "bg-gray-900 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                        onClick={() => {
                            setStatus("all");
                            setPage(1);
                        }}
                        disabled={loading}
                    >
                        All
                    </button>
                </div>

                <div className="inline-flex items-center gap-2">
                    <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${status === "upcoming"
                            ? "bg-gray-900 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                        onClick={() => {
                            setStatus("upcoming");
                            setPage(1);
                        }}
                        disabled={loading}
                    >
                        Upcoming
                    </button>
                    <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${status === "passed"
                            ? "bg-gray-900 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                        onClick={() => {
                            setStatus("passed");
                            setPage(1);
                        }}
                        disabled={loading}
                    >
                        History
                    </button>
                </div>

                {/* Preferred language */}
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Language</Label>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-[220px] justify-between"
                                disabled={loading}
                            >
                                <span className="truncate">
                                    {preferredLangName || "Choose language"}
                                </span>
                            </Button>
                        </PopoverTrigger>

                        <PopoverContent
                            className="p-0 w-[280px]"
                            align="start"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <Command>
                                <CommandInput placeholder="Search languages…" />
                                <CommandEmpty>No languages found.</CommandEmpty>
                                <CommandList className="max-H-64 overflow-y-auto overscroll-contain">
                                    <CommandGroup>
                                        {languageDisplayNames.map((name) => (
                                            <CommandItem
                                                key={name}
                                                onSelect={() => {
                                                    setPreferredLangName(name);
                                                    setPage(1);
                                                }}
                                            >
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Table */}
            <div style={{ height: "65vh" }}>
                <EventInstancesTable
                    rows={rows}
                    loading={loading}
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    pages={pages}
                    sortBySeriesIndexAsc={sortBySeriesIndexAsc}
                    onToggleSeriesSort={(asc) => { setSortBySeriesIndexAsc(asc); setPage(1); }}
                    onPageChange={(p) => setPage(p)}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                    onInstanceSaved={() => refresh()}
                />
            </div>
        </div>
    );
}
