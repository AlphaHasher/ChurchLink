import React, { useEffect, useRef, useState, useMemo } from "react";
import { EventListTile } from "@/features/eventsV2/components/EventListTile";
import { useFetchUserEvents } from "@/helpers/EventUserHelper";
import { fetchMinistries } from "@/helpers/MinistriesHelper";

import type {
    UserFacingEvent,
    UserEventResults,
    UserEventSearchParams,
    EventGenderOption,
} from "@/shared/types/Event";
import type { Ministry } from "@/shared/types/Ministry";

import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Input } from "@/shared/components/ui/input";
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
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Filter } from "lucide-react";

export type EventSectionProps = {
    showFilters?: boolean;
    lockedFilters?: { ministry?: string; ageRange?: string };
    title?: string;
    showTitle?: boolean;
};

const DEFAULT_PARAMS: UserEventSearchParams = {
    limit: 12,
    unique_only: false,
    preferred_lang: "en",
};

function useDebounce<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState<T>(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

const EventSection: React.FC<EventSectionProps> = ({
    showFilters = true,
    lockedFilters,
    title,
    showTitle = true,
}) => {
    const { fetchUserEvents, isSignedIn, endpoint } = useFetchUserEvents();
    const filtersLocked = !!lockedFilters && Object.keys(lockedFilters).length > 0;

    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [items, setItems] = useState<UserFacingEvent[]>([]);
    const [cursor, setCursor] = useState<UserEventResults["next_cursor"]>(null);
    const [error, setError] = useState<string | null>(null);
    const reqSeq = useRef(0);

    const [allMinistries, setAllMinistries] = useState<Ministry[]>([]);
    const ministryNameMap = useMemo(
        () => buildMinistryNameMap(allMinistries),
        [allMinistries]
    );
    const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
    const [gender, setGender] = useState<"all" | "male" | "female" | "male_only" | "female_only">("all");
    const [minAge, setMinAge] = useState<string>("");
    const [maxAge, setMaxAge] = useState<string>("");
    const [uniqueOnly, setUniqueOnly] = useState<boolean>(false);

    const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
    const [membersOnlyOnly, setMembersOnlyOnly] = useState<boolean>(false);
    const [maxPrice, setMaxPrice] = useState<string>("");

    const debouncedMinAge = useDebounce(minAge, 350);
    const debouncedMaxAge = useDebounce(maxAge, 350);
    const debouncedMaxPrice = useDebounce(maxPrice, 350);

    const buildParams = (overrides?: Partial<UserEventSearchParams>): UserEventSearchParams => {
        const p: UserEventSearchParams = {
            ...DEFAULT_PARAMS,
            min_age: debouncedMinAge ? Number(debouncedMinAge) : null,
            max_age: debouncedMaxAge ? Number(debouncedMaxAge) : null,
            gender: gender === "all" ? null : (gender as EventGenderOption),
            ministries: selectedMinistries.length ? selectedMinistries : null,
            unique_only: uniqueOnly,

            favorites_only: isSignedIn ? favoritesOnly : null,
            members_only_only: membersOnlyOnly,
            max_price: debouncedMaxPrice ? Number(debouncedMaxPrice) : null,

            ...overrides,
        };
        return p;
    };

    // Initial ministries
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

    // Initial fetch + refetch on auth/filters
    useEffect(() => {
        let alive = true;
        const mySeq = ++reqSeq.current;

        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetchUserEvents(buildParams());
                if (!alive || mySeq !== reqSeq.current) return;
                setItems(res.items || []);
                setCursor(res.next_cursor ?? null);
            } catch (e: any) {
                if (!alive || mySeq !== reqSeq.current) return;
                setError(e?.message ?? "Failed to load events.");
                setItems([]);
                setCursor(null);
            } finally {
                if (alive && mySeq === reqSeq.current) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [
        isSignedIn,
        endpoint,
        fetchUserEvents,
        debouncedMinAge,
        debouncedMaxAge,
        gender,
        selectedMinistries,
        uniqueOnly,
        favoritesOnly,
        membersOnlyOnly,
        debouncedMaxPrice,
    ]);

    // Load more
    async function onLoadMore() {
        if (!cursor) return;
        setLoading(true);
        try {
            const res = await fetchUserEvents(
                buildParams({
                    cursor_scheduled_date: cursor.scheduled_date,
                    cursor_id: cursor.id,
                })
            );
            setItems((prev) => [...prev, ...(res.items || [])]);
            setCursor(res.next_cursor ?? null);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load more events.");
        } finally {
            setLoading(false);
        }
    }

    // Refresh after favorite toggle (also optimistically sync current page)
    async function onFavoriteChanged(eventId: string, newIsFav: boolean) {
        // Optimistic local propagation across the same parent series
        setItems((prev) =>
            prev.map((ev) => (ev.event_id === eventId ? { ...ev, is_favorited: newIsFav } : ev))
        );

        // Re-hit backend to rebuild pages with current filters and keep cursor correct
        try {
            setRefreshing(true);
            const res = await fetchUserEvents(
                buildParams({ limit: Math.max((items.length || 0), DEFAULT_PARAMS.limit || 12) })
            );
            setItems(res.items || []);
            setCursor(res.next_cursor ?? null);
        } catch (e: any) {
            console.error("Refresh after favorite failed", e);
        } finally {
            setRefreshing(false);
        }
    }

    function buildMinistryNameMap(list: Ministry[]): Record<string, string> {
        const map: Record<string, string> = {};
        for (const m of list || []) {
            if (!m?.id) continue;
            const name = (m.name ?? "").toString().trim();
            if (name) map[m.id] = name;
        }
        return map;
    }
    // Filters UI
    const FiltersBar = showFilters ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
            {filtersLocked ? (
                <Button variant="outline" className="gap-2" disabled aria-disabled="true" title="Filters are locked">
                    <Filter size={16} />
                    Filters
                </Button>
            ) : (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter size={16} />
                            Filters
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[720px]" align="start" onWheel={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Gender */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="genderSel">Gender admission</Label>
                                <Select value={gender} onValueChange={(v) => setGender(v as any)}>
                                    <SelectTrigger id="genderSel">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Allowed</SelectItem>
                                        <SelectItem value="male">Men Allowed</SelectItem>
                                        <SelectItem value="female">Women Allowed</SelectItem>
                                        <SelectItem value="male_only">Men Only</SelectItem>
                                        <SelectItem value="female_only">Women Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Unique-only */}
                            <div className="flex flex-col gap-1">
                                <Label>Show only one per series</Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <Checkbox
                                        checked={uniqueOnly}
                                        onCheckedChange={(v) => setUniqueOnly(Boolean(v))}
                                        id="uniqueOnlyChk"
                                    />
                                    <label htmlFor="uniqueOnlyChk" className="text-sm text-slate-700">
                                        Unique only (earliest upcoming per event)
                                    </label>
                                </div>
                            </div>

                            {/* Min / Max Age */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="minAge">Min Age</Label>
                                <Input
                                    id="minAge"
                                    inputMode="numeric"
                                    value={minAge}
                                    onChange={(e) => setMinAge(e.target.value.replace(/[^\d]/g, ""))}
                                    placeholder="e.g. 20"
                                />
                                <p className="text-xs text-slate-500">
                                    We’ll show events that admit <strong>everyone</strong> between your minimum and maximum ages would be allowed to attend, for all ages.
                                </p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="maxAge">Max Age</Label>
                                <Input
                                    id="maxAge"
                                    inputMode="numeric"
                                    value={maxAge}
                                    onChange={(e) => setMaxAge(e.target.value.replace(/[^\d]/g, ""))}
                                    placeholder="e.g. 35"
                                />
                            </div>

                            {/* Ministries */}
                            <div className="col-span-2 flex flex-col gap-1">
                                <Label>Ministries</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between">
                                            {selectedMinistries.length
                                                ? `${selectedMinistries.length} selected`
                                                : "Choose ministries"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="p-0 w-[420px]"
                                        align="start"
                                        onWheel={(e) => e.stopPropagation()}
                                    >
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
                                                                    setSelectedMinistries((prev) => {
                                                                        const next = new Set(prev);
                                                                        if (checked) next.delete(m.id);
                                                                        else next.add(m.id);
                                                                        return Array.from(next);
                                                                    })
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
                                    <div className="flex justify-end pt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs"
                                            onClick={() => setSelectedMinistries([])}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Members-only */}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="membersOnlyOnlyChk"
                                    checked={membersOnlyOnly}
                                    onCheckedChange={(v) => setMembersOnlyOnly(Boolean(v))}
                                />
                                <Label htmlFor="membersOnlyOnlyChk">Members-only events only</Label>
                            </div>

                            {/* Favorites-only (auth only) */}
                            {isSignedIn && (
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="favoritesOnlyChk"
                                        checked={favoritesOnly}
                                        onCheckedChange={(v) => setFavoritesOnly(Boolean(v))}
                                    />
                                    <Label htmlFor="favoritesOnlyChk">Favorites only</Label>
                                </div>
                            )}

                            {/* Max price */}
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="maxPrice">Max Price</Label>
                                <Input
                                    id="maxPrice"
                                    inputMode="decimal"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))}
                                    placeholder="e.g. 5.25"
                                />
                                <p className="text-xs text-slate-500">
                                    We’ll show events that are either free or priced at or below this amount in $USD.
                                </p>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    ) : null;

    return (
        <section className="w-full bg-white">
            <div className="w-full max-w-screen-xl mx-auto px-4 py-8">
                {showTitle !== false && (
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">
                        {title || "Upcoming Events"}
                    </h2>
                )}

                {FiltersBar}

                {error && (
                    <div className="text-sm text-red-600 mb-4">{String(error)}</div>
                )}

                {loading && items.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: DEFAULT_PARAMS.limit }).map((_, i) => (
                            <Skeleton key={i} className="h-64 w-full rounded-xl" />
                        ))}
                    </div>
                ) : null}

                {!loading && items.length === 0 ? (
                    <div className="text-center text-slate-600 py-16">
                        <div className="text-5xl mb-2">📅</div>
                        <div className="text-lg font-semibold">
                            There are no upcoming events.
                        </div>
                    </div>
                ) : null}

                {items.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {items.map((ev) => (
                                <EventListTile
                                    key={ev.id}
                                    event={ev}
                                    ministryNameMap={ministryNameMap}
                                    onFavoriteChanged={onFavoriteChanged}
                                    disabled={refreshing}
                                />
                            ))}
                        </div>

                        <div className="flex justify-center mt-8">
                            {cursor ? (
                                <Button variant="default" onClick={onLoadMore} disabled={loading || refreshing}>
                                    {loading || refreshing ? "Loading…" : "Load more"}
                                </Button>
                            ) : (
                                <div className="text-sm text-slate-500">No more events.</div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default EventSection;