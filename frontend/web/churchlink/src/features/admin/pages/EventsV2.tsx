import { useEffect, useMemo, useRef, useState } from "react";
import EventsTableV2 from "@/features/admin/components/EventsV2/EventsTableV2";
import { fetchPagedAdminPanelEvents } from "@/helpers/EventManagementHelper";
import { fetchMinistries } from "@/helpers/MinistriesHelper";
import type {
    AdminEventSearchParams,
    EventGenderOption,
    ReadAdminPanelEvent,
} from "@/shared/types/Event";
import type { Ministry } from "@/shared/types/Ministry";

import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/shared/components/ui/select";
import {
    Popover, PopoverTrigger, PopoverContent,
} from "@/shared/components/ui/popover";
import {
    Command, CommandInput, CommandEmpty, CommandList, CommandGroup, CommandItem,
} from "@/shared/components/ui/command";
import CreateEventDialogV2 from "@/features/admin/components/EventsV2/CreateEventDialogV2";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Filter } from "lucide-react";

import { localizationNameToCode } from "@/shared/dictionaries/LocalizationDicts";

// ---------- debounce ----------
function useDebounce<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState<T>(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

const defaultPageSize = 25;

export default function EventsV2() {
    const [rows, setRows] = useState<ReadAdminPanelEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);

    const [query, setQuery] = useState<string>("");

    const languageDisplayNames = useMemo(
        () => Object.keys(localizationNameToCode).sort((a, b) => a.localeCompare(b)),
        [],
    );
    const defaultLanguageName = useMemo(() => {
        const enName = Object.entries(localizationNameToCode).find(([, c]) => c === "en")?.[0];
        return enName ?? languageDisplayNames[0] ?? "English";
    }, [languageDisplayNames]);
    const [preferredLangName, setPreferredLangName] = useState<string>(defaultLanguageName);

    const [allMinistries, setAllMinistries] = useState<Ministry[]>([]);
    const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
    const ministryMap = useMemo<Record<string, string>>(
        () => Object.fromEntries(allMinistries.map((m) => [m.id, m.name])),
        [allMinistries],
    );

    const [registrationAllowed, setRegistrationAllowed] = useState<"Any" | "true" | "false">("Any");
    const [hidden, setHidden] = useState<"Any" | "true" | "false">("Any");
    const [membersOnly, setMembersOnly] = useState<"Any" | "true" | "false">("Any");
    const [rsvpRequired, setRsvpRequired] = useState<"Any" | "true" | "false">("Any");
    const [minAge, setMinAge] = useState<string>("");
    const [maxAge, setMaxAge] = useState<string>("");
    const [gender, setGender] = useState<"Any" | EventGenderOption>("Any");

    const [sortByDateAsc, setSortByDateAsc] = useState(false);

    // debounced “typing” fields
    // debouncing is so that annoying bug where you type and get "locked up" because API requests are made doesn't happen
    const debouncedQuery = useDebounce(query, 400);
    const debouncedMinAge = useDebounce(minAge, 400);
    const debouncedMaxAge = useDebounce(maxAge, 400);

    const asBool = (v: "Any" | "true" | "false"): boolean | undefined => {
        if (v === "Any") return undefined;
        return v === "true";
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetchMinistries();
                setAllMinistries(res ?? []);
            } catch (e) {
                console.error("Failed to load ministries", e);
            }
        })();
    }, []);

    const requestSeqRef = useRef(0);

    const refresh = async (overrides?: Partial<AdminEventSearchParams>) => {
        const seq = ++requestSeqRef.current;
        const preferredLangCode = localizationNameToCode[preferredLangName] || "en";

        const params: AdminEventSearchParams = {
            page,
            limit: pageSize,
            query: debouncedQuery || undefined,
            ministries: selectedMinistries.length ? selectedMinistries : undefined,
            registration_allowed: asBool(registrationAllowed) ?? null,
            hidden: asBool(hidden) ?? null,
            members_only: asBool(membersOnly) ?? null,
            rsvp_required: asBool(rsvpRequired) ?? null,
            min_age: debouncedMinAge ? Number(debouncedMinAge) : null,
            max_age: debouncedMaxAge ? Number(debouncedMaxAge) : null,
            gender: gender === "Any" ? null : gender,
            preferred_lang: preferredLangCode,
            sort_by_date_asc: sortByDateAsc,
            ...overrides,
        };

        setLoading(true);
        try {
            const res = await fetchPagedAdminPanelEvents(params);
            if (seq !== requestSeqRef.current) return;
            setRows(res.items || []);
            setTotal(res.total || 0);
            setPages(res.pages || 0);
        } catch (err) {
            if (seq !== requestSeqRef.current) return;
            console.error("Failed to fetch events:", err);
            setRows([]);
            setTotal(0);
            setPages(0);
        } finally {
            if (seq === requestSeqRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [
        page,
        pageSize,
        debouncedQuery,
        debouncedMinAge,
        debouncedMaxAge,
        registrationAllowed,
        hidden,
        membersOnly,
        rsvpRequired,
        gender,
        sortByDateAsc,
        preferredLangName,
        selectedMinistries,
    ]);

    const applyResetToPage1 = (fn: () => void) => {
        fn();
        setPage(1);
        refresh({ page: 1 });
    };

    return (
        <div className="flex flex-col gap-4 p-6 overflow-x-hidden">
            <h1 className="text-xl font-bold mb-4">Events</h1>
            {/* Quick bar: search, language, ministries, Filters button */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <Input
                    className="w-[320px]"
                    placeholder="Search events…"
                    value={query}
                    onChange={(e) => {
                        setPage(1);
                        setQuery(e.target.value);
                    }}
                    disabled={loading}
                />

                {/* Preferred language (searchable, near search input) */}
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Language</Label>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-[220px] justify-between"
                                disabled={loading}
                            >
                                <span className="truncate">{preferredLangName || "Choose language"}</span>
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
                                <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                    <CommandGroup>
                                        {languageDisplayNames.map((name) => (
                                            <CommandItem
                                                key={name}
                                                onSelect={() =>
                                                    applyResetToPage1(() => setPreferredLangName(name))
                                                }
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

                {/* Ministries multi-select (actual multi, near search) */}
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Ministries</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[300px] justify-between" disabled={loading}>
                                {selectedMinistries.length
                                    ? `${selectedMinistries.length} selected`
                                    : "Choose ministries"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[320px]" align="start" onWheel={(e) => e.stopPropagation()}>
                            <Command>
                                <CommandInput placeholder="Search ministries…" />
                                <CommandEmpty>No ministries found.</CommandEmpty>
                                <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                    <CommandGroup>
                                        {allMinistries.map((m) => {
                                            const checked = selectedMinistries.includes(m.id);
                                            return (
                                                <CommandItem
                                                    key={m.id}
                                                    onSelect={() =>
                                                        applyResetToPage1(() =>
                                                            setSelectedMinistries((prev) => {
                                                                const next = new Set(prev);
                                                                if (checked) next.delete(m.id);
                                                                else next.add(m.id);
                                                                return Array.from(next);
                                                            }),
                                                        )
                                                    }
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox checked={checked} />
                                                        <span className="truncate">{m.name}</span>
                                                    </div>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {selectedMinistries.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                applyResetToPage1(() => setSelectedMinistries([]))
                            }
                            disabled={loading}
                            className="text-xs"
                        >
                            Clear
                        </Button>
                    )}
                </div>

                {/* Remaining “Filters” in a popover (not language/ministries) */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2" disabled={loading}>
                            <Filter size={16} />
                            Filters
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[720px]">
                        <div className="grid grid-cols-2 gap-4">
                            {/* registration_allowed */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="regAllowedSel">Registration Allowed</Label>
                                <Select
                                    value={registrationAllowed}
                                    onValueChange={(v) =>
                                        applyResetToPage1(() =>
                                            setRegistrationAllowed(v as "Any" | "true" | "false"),
                                        )
                                    }
                                    disabled={loading}
                                >
                                    <SelectTrigger id="regAllowedSel">
                                        <SelectValue placeholder="Registration gate" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Any">Any</SelectItem>
                                        <SelectItem value="true">Registration Open</SelectItem>
                                        <SelectItem value="false">Registration Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* hidden */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="hiddenSel">Visibility</Label>
                                <Select
                                    value={hidden}
                                    onValueChange={(v) =>
                                        applyResetToPage1(() => setHidden(v as "Any" | "true" | "false"))
                                    }
                                    disabled={loading}
                                >
                                    <SelectTrigger id="hiddenSel">
                                        <SelectValue placeholder="Visibility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Any">Any</SelectItem>
                                        <SelectItem value="true">Hidden</SelectItem>
                                        <SelectItem value="false">Visible Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* members_only */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="membersOnlySel">Members Only</Label>
                                <Select
                                    value={membersOnly}
                                    onValueChange={(v) =>
                                        applyResetToPage1(() =>
                                            setMembersOnly(v as "Any" | "true" | "false"),
                                        )
                                    }
                                    disabled={loading}
                                >
                                    <SelectTrigger id="membersOnlySel">
                                        <SelectValue placeholder="Audience restriction" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Any">Any</SelectItem>
                                        <SelectItem value="true">Members Only</SelectItem>
                                        <SelectItem value="false">Open to All</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* rsvp_required */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="rsvpReqSel">RSVP Required</Label>
                                <Select
                                    value={rsvpRequired}
                                    onValueChange={(v) =>
                                        applyResetToPage1(() =>
                                            setRsvpRequired(v as "Any" | "true" | "false"),
                                        )
                                    }
                                    disabled={loading}
                                >
                                    <SelectTrigger id="rsvpReqSel">
                                        <SelectValue placeholder="RSVP" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Any">Any</SelectItem>
                                        <SelectItem value="true">RSVP Required</SelectItem>
                                        <SelectItem value="false">RSVP Optional</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* min/max age */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="minAge">Min Age</Label>
                                <Input
                                    id="minAge"
                                    inputMode="numeric"
                                    value={minAge}
                                    onChange={(e) => {
                                        setPage(1);
                                        setMinAge(e.target.value.replace(/[^\d]/g, ""));
                                    }}
                                    disabled={loading}
                                    placeholder="e.g. 12"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="maxAge">Max Age</Label>
                                <Input
                                    id="maxAge"
                                    inputMode="numeric"
                                    value={maxAge}
                                    onChange={(e) => {
                                        setPage(1);
                                        setMaxAge(e.target.value.replace(/[^\d]/g, ""));
                                    }}
                                    disabled={loading}
                                    placeholder="e.g. 18"
                                />
                            </div>

                            {/* gender */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="genderSel">Gender</Label>
                                <Select
                                    value={gender}
                                    onValueChange={(v) =>
                                        applyResetToPage1(() => setGender(v as any))
                                    }
                                    disabled={loading}
                                >
                                    <SelectTrigger id="genderSel">
                                        <SelectValue placeholder="Gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Any">Any</SelectItem>
                                        <SelectItem value="all">All Allowed</SelectItem>
                                        <SelectItem value="male">Men Allowed</SelectItem>
                                        <SelectItem value="female">Women Allowed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* sort by date direction */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="sortDir">Date Updated On</Label>
                                <Select
                                    value={sortByDateAsc ? "asc" : "desc"}
                                    onValueChange={(v) =>
                                        applyResetToPage1(() => setSortByDateAsc(v === "asc"))
                                    }
                                    disabled={loading}
                                >
                                    <SelectTrigger id="sortDir">
                                        <SelectValue placeholder="Sort order" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="asc">Oldest → Newest</SelectItem>
                                        <SelectItem value="desc">Newest → Oldest</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Create */}
                <div className="ml-auto">
                    <CreateEventDialogV2
                        allMinistries={allMinistries}
                        preferredLangCode={localizationNameToCode[preferredLangName] || "en"}
                        onCreated={() => {
                            setPage(1);
                            refresh({ page: 1 });
                        }}
                    />
                </div>
            </div>

            {/* Table */}
            <div style={{ height: "65vh" }}>
                <EventsTableV2
                    rows={rows}
                    loading={loading}
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    pages={pages}
                    sortByDateAsc={sortByDateAsc}
                    onToggleDateSort={(asc) => {
                        setPage(1);
                        setSortByDateAsc(asc);
                        refresh({ page: 1, sort_by_date_asc: asc });
                    }}
                    onPageChange={(p) => {
                        setPage(p);
                        refresh({ page: p });
                    }}
                    onPageSizeChange={(s) => {
                        setPage(1);
                        setPageSize(s);
                        refresh({ page: 1, limit: s });
                    }}
                    ministryMap={ministryMap}
                    allMinistries={allMinistries}
                    preferredLangCode={localizationNameToCode[preferredLangName] || "en"}
                    onEdited={() => {
                        refresh();
                    }}
                />
            </div>
        </div>
    );
}
