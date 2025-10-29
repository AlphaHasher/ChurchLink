import api from "../api/api";
import { useAuth } from "@/features/auth/hooks/auth-context";
import {
    UserEventSearchParams,
    UserEventResults,
} from "@/shared/types/Event";
import { convertUserFacingEventsToUserTime } from "./TimeFormatter";
import { useCallback, useMemo } from "react";

/**
 * Build query params that match our backend contract.
 * - Flattens ministries array to CSV.
 * - Strips null/undefined/"" to keep the URL clean.
 * - Passes through new user filters: favorites_only, members_only_only, max_price.
 */
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

// Uses useAuth to determine if the endpoint needs to be the private or public event endpoint
function endpointFor(isSignedIn: boolean): string {
    return isSignedIn ? "/v1/events/upcoming-private" : "/v1/events/upcoming-public";
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