import { useEffect, useRef, useState, useCallback } from "react";
import { EventListTile } from "@/features/eventsV2/components/EventListTile";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Label } from "@/shared/components/ui/label";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/shared/components/ui/select";

import {
    MyEventsSearchParams,
    MyEventsResults,
    MyEventsTypeFilter,
    MyEventsDateFilter,
    UserFacingEvent,
} from "@/shared/types/Event";

import { fetchMyEvents } from "@/helpers/EventUserHelper";

const DEFAULT_PARAMS: MyEventsSearchParams = {
    limit: 12,
    preferred_lang: "en",
    type: "favorites_and_registered",
    date: "upcoming",
};

export default function MyEventsPageV2() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [items, setItems] = useState<UserFacingEvent[]>([]);
    const [cursor, setCursor] = useState<MyEventsResults["next_cursor"]>(null);
    const [error, setError] = useState<string | null>(null);
    const reqSeq = useRef(0);

    const [typeFilter, setTypeFilter] = useState<MyEventsTypeFilter>(
        (DEFAULT_PARAMS.type as MyEventsTypeFilter) || "favorites_and_registered"
    );
    const [dateFilter, setDateFilter] = useState<MyEventsDateFilter>(
        (DEFAULT_PARAMS.date as MyEventsDateFilter) || "upcoming"
    );

    const buildParams = useCallback(
        (overrides?: Partial<MyEventsSearchParams>): MyEventsSearchParams => {
            const p: MyEventsSearchParams = {
                ...DEFAULT_PARAMS,
                type: typeFilter,
                date: dateFilter,
                ...overrides,
            };
            const cleaned: Record<string, any> = { ...p };
            Object.keys(cleaned).forEach((k) => {
                const v = cleaned[k];
                if (v === null || v === undefined || v === "") delete cleaned[k];
            });
            return cleaned as MyEventsSearchParams;
        },
        [typeFilter, dateFilter]
    );

    useEffect(() => {
        let alive = true;
        const mySeq = ++reqSeq.current;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetchMyEvents(buildParams());
                if (!alive || mySeq !== reqSeq.current) return;
                setItems(Array.isArray(res.items) ? res.items : []);
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
    }, [buildParams]);

    async function onLoadMore() {
        if (!cursor) return;
        setLoading(true);
        try {
            const res = await fetchMyEvents(
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

    async function onFavoriteChanged(eventId: string, newIsFav: boolean) {
        setItems((prev) =>
            prev.map((ev) => (ev.event_id === eventId ? { ...ev, is_favorited: newIsFav } : ev))
        );
        try {
            setRefreshing(true);
            const res = await fetchMyEvents(
                buildParams({ limit: Math.max((items.length || 0), DEFAULT_PARAMS.limit || 12) })
            );
            setItems(res.items || []);
            setCursor(res.next_cursor ?? null);
        } catch {
            // keep optimistic state
        } finally {
            setRefreshing(false);
        }
    }

    const hasItems = (items?.length || 0) > 0;

    return (
        <section className="w-full bg-white">
            <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10">
                <h2 className="mb-4 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                    My Events
                </h2>

                {/* Inline filters */}
                <div className="mb-6 rounded-xl border bg-white px-4 py-3">
                    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="typeSel" className="text-sm text-slate-600">
                                Which Type of Events to Show
                            </Label>
                            <Select
                                value={typeFilter}
                                onValueChange={(v) => setTypeFilter(v as MyEventsTypeFilter)}
                            >
                                <SelectTrigger id="typeSel" className="h-9">
                                    <SelectValue placeholder="Choose…" />
                                </SelectTrigger>
                                <SelectContent className="z-50" position="popper" sideOffset={6} align="start">
                                    <SelectItem value="favorites_and_registered">Registered or Favorited</SelectItem>
                                    <SelectItem value="registered">All Registered</SelectItem>
                                    <SelectItem value="registered_not_favorited">Registered but not Favorited</SelectItem>
                                    <SelectItem value="favorites">All Favorited</SelectItem>
                                    <SelectItem value="favorites_not_registered">Favorited but not Registered</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label htmlFor="dateSel" className="text-sm text-slate-600">
                                When the Events take Place
                            </Label>
                            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as MyEventsDateFilter)}>
                                <SelectTrigger id="dateSel" className="h-9">
                                    <SelectValue placeholder="Choose…" />
                                </SelectTrigger>
                                <SelectContent className="z-50" position="popper" sideOffset={6} align="start">
                                    <SelectItem value="upcoming">Upcoming</SelectItem>
                                    <SelectItem value="history">History</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {String(error)}
                    </div>
                )}

                {loading && items.length === 0 && (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: DEFAULT_PARAMS.limit || 12 }).map((_, i) => (
                            <Skeleton key={i} className="h-64 w-full rounded-xl" />
                        ))}
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="py-16 text-center text-slate-600">
                        <div className="mb-2 text-5xl">📅</div>
                        <div className="text-lg font-semibold">No events matched your filters.</div>
                    </div>
                )}

                {hasItems && (
                    <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((ev) => (
                                <EventListTile key={ev.id} event={ev} onFavoriteChanged={onFavoriteChanged} />
                            ))}
                        </div>

                        <div className="mt-8 flex justify-center">
                            {cursor ? (
                                <Button onClick={onLoadMore} disabled={loading || refreshing}>
                                    {loading || refreshing ? "Loading…" : "Load more"}
                                </Button>
                            ) : (
                                <div className="text-sm text-slate-500">No more events.</div>
                            )}
                        </div>
                    </>
                )}

                {refreshing && (
                    <div className="mt-3 text-center text-xs text-muted-foreground">Updating list…</div>
                )}
            </div>
        </section>
    );
}
