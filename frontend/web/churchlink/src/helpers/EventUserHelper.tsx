import api from "../api/api";
import { useAuth } from "@/features/auth/hooks/auth-context";
import {
    UserEventSearchParams,
    UserEventResults, MyEventsSearchParams, MyEventsResults
} from "@/shared/types/Event";
import { convertUserFacingEventsToUserTime, convertSisterInstanceIdentifiersToUserTime } from "./TimeFormatter";
import { useCallback, useMemo } from "react";
import { EventDetailsResponse } from "@/shared/types/Event";



function buildQuery(params: UserEventSearchParams): Record<string, any> {
    const {
        ministries,
        ...rest
    } = params ?? ({} as UserEventSearchParams);

    const cleaned: Record<string, any> = {
        ...rest,
        ...(Array.isArray(ministries) && ministries.length
            ? { ministries: ministries.join(",") }
            : {}),
    };

    Object.keys(cleaned).forEach((k) => {
        const v = cleaned[k];
        if (v === null || v === undefined || v === "") delete cleaned[k];
    });

    return cleaned;
}

function buildMyEventsQuery(params: MyEventsSearchParams): Record<string, any> {
    const cleaned: Record<string, any> = { ...(params ?? {}) };
    Object.keys(cleaned).forEach((k) => {
        const v = cleaned[k];
        if (v === null || v === undefined || v === "") delete cleaned[k];
    });
    return cleaned;
}

// USE AUTH CONDITIONALS
// Uses useAuth to determine if the endpoint needs to be the private or public event endpoint

function endpointFor(isSignedIn: boolean): string {
    return isSignedIn ? "/v1/events/upcoming-private" : "/v1/events/upcoming-public";
}

function detailsEndpointFor(isSignedIn: boolean): string {
    return isSignedIn
        ? "/v1/events/private-event-instance-details"
        : "/v1/events/public-event-instance-details";
}

// Fetches events and uses a proper private/public split using useAuth to determine if a user is signed in
export function useFetchUserEvents() {
    const auth = useAuth();
    const isSignedIn =
        !!(auth as any)?.user ||
        !!(auth as any)?.currentUser ||
        !!(auth as any)?.uid;

    // Memoize endpoint so it doesn't flap unless auth flips
    // I got an insane flip flop flicker bug when this wasn't around, trust me on this, spare your eyes and don't change this
    const endpoint = useMemo(() => endpointFor(isSignedIn), [isSignedIn]);

    const fetchUserEvents = useCallback(
        async (params: UserEventSearchParams): Promise<UserEventResults> => {
            const q = buildQuery(params);
            try {
                const res = await api.get(endpoint, { params: q });
                const data = (res?.data ?? {}) as UserEventResults;

                if (!data || !Array.isArray(data.items)) {
                    return { items: [], next_cursor: null };
                }

                const items = convertUserFacingEventsToUserTime(data.items) ?? [];
                return { items, next_cursor: data.next_cursor ?? null };
            } catch (err) {
                console.error("[EventUserHelper] fetchUserEvents() -> error", err);
                return { items: [], next_cursor: null };
            }
        },
        [endpoint, isSignedIn]
    );

    return { fetchUserEvents, isSignedIn, endpoint };
}

export async function fetchMyEvents(
    params: MyEventsSearchParams
): Promise<MyEventsResults> {
    const q = buildMyEventsQuery(params);
    try {
        const res = await api.get("/v1/events/search-my-events", { params: q });
        const data = (res?.data ?? {}) as UserEventResults;

        if (!data || !Array.isArray(data.items)) {
            return { items: [], next_cursor: null };
        }

        const items = convertUserFacingEventsToUserTime(data.items) ?? [];
        return { items, next_cursor: data.next_cursor ?? null };
    } catch (err) {
        console.error("[EventUserHelper] fetchMyEvents() -> error", err);
        return { items: [], next_cursor: null };
    }
}

export async function favoriteEvent(eventId: string): Promise<boolean> {
    if (!eventId) return false;
    try {
        await api.put(`/v1/events/add-favorite/${encodeURIComponent(eventId)}`);
        return true;
    } catch (err) {
        console.error("[EventUserHelper] favoriteEvent() -> error", err);
        return false;
    }
}

export async function unfavoriteEvent(eventId: string): Promise<boolean> {
    if (!eventId) return false;
    try {
        await api.put(`/v1/events/remove-favorite/${encodeURIComponent(eventId)}`);
        return true;
    } catch (err) {
        console.error("[EventUserHelper] unfavoriteEvent() -> error", err);
        return false;
    }
}

export async function setFavorite(eventId: string, makeFavorite: boolean): Promise<boolean> {
    return makeFavorite ? favoriteEvent(eventId) : unfavoriteEvent(eventId);
}

export function useFetchEventInstanceDetails() {
    const auth = useAuth();
    const isSignedIn =
        !!(auth as any)?.user ||
        !!(auth as any)?.currentUser ||
        !!(auth as any)?.uid;

    const base = useMemo(() => detailsEndpointFor(isSignedIn), [isSignedIn]);

    const fetchEventInstanceDetails = useCallback(
        async (instanceId: string): Promise<EventDetailsResponse> => {
            if (!instanceId) {
                return { success: false, msg: "No instance id", event_details: null, sister_details: [], ministries: [] };
            }
            try {
                const res = await api.get(`${base}/${encodeURIComponent(instanceId)}`);
                const data = (res?.data ?? {}) as EventDetailsResponse;

                if (data?.event_details) {
                    const [converted] = convertUserFacingEventsToUserTime([data.event_details]) ?? [];
                    data.event_details = converted ?? data.event_details;
                }
                data.sister_details = convertSisterInstanceIdentifiersToUserTime(data.sister_details);

                return data;
            } catch (err) {
                console.error("[EventUserHelper] fetchEventInstanceDetails() -> error", err);
                return { success: false, msg: "Failed to load event details", event_details: null, sister_details: [], ministries: [] };
            }
        },
        [base]
    );

    return { fetchEventInstanceDetails, isSignedIn, endpoint: base };
}