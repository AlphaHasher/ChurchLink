import api from "../api/api";
import { useAuth } from "@/features/auth/hooks/auth-context";
import {
    UserEventSearchParams,
    UserEventResults,
    MyEventsSearchParams,
    MyEventsResults
} from "@/shared/types/Event";
import { convertUserFacingEventsToUserTime, convertSisterInstanceIdentifiersToUserTime } from "./TimeFormatter";
import { useCallback, useMemo } from "react";
import { EventDetailsResponse } from "@/shared/types/Event";
import { useLanguage } from "@/provider/LanguageProvider";

function buildQuery(
    params: UserEventSearchParams,
    preferredLangFromHook?: string | null
): Record<string, any> {
    const {
        ministries,
        preferred_lang,
        ...rest
    } = params ?? ({} as UserEventSearchParams);

    const cleaned: Record<string, any> = {
        ...rest,
        ...(Array.isArray(ministries) && ministries.length
            ? { ministries: ministries.join(",") }
            : {}),
    };

    // Prefer an explicit preferred_lang in params, otherwise fall back to the hook value
    const langToUse =
        typeof preferred_lang === "string" && preferred_lang.trim() !== ""
            ? preferred_lang.trim()
            : typeof preferredLangFromHook === "string" && preferredLangFromHook.trim() !== ""
                ? preferredLangFromHook.trim()
                : null;

    if (langToUse) {
        cleaned.preferred_lang = langToUse;
    }

    Object.keys(cleaned).forEach((k) => {
        const v = cleaned[k];
        if (v === null || v === undefined || v === "") delete cleaned[k];
    });

    return cleaned;
}

function buildMyEventsQuery(
    params: MyEventsSearchParams,
    preferredLangFromHook?: string | null
): Record<string, any> {
    const {
        preferred_lang,
        ...rest
    } = params ?? {};

    const cleaned: Record<string, any> = { ...rest };

    const langToUse =
        typeof preferred_lang === "string" && preferred_lang.trim() !== ""
            ? preferred_lang.trim()
            : typeof preferredLangFromHook === "string" && preferredLangFromHook.trim() !== ""
                ? preferredLangFromHook.trim()
                : null;

    if (langToUse) {
        cleaned.preferred_lang = langToUse;
    }

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
    const language_code = useLanguage().locale;
    const isSignedIn =
        !!(auth as any)?.user ||
        !!(auth as any)?.currentUser ||
        !!(auth as any)?.uid;

    // Memoize endpoint so it doesn't flap unless auth flips
    // I got an insane flip flop flicker bug when this wasn't around, trust me on this, spare your eyes and don't change this
    const endpoint = useMemo(() => endpointFor(isSignedIn), [isSignedIn]);

    const fetchUserEvents = useCallback(
        async (params: UserEventSearchParams): Promise<UserEventResults> => {
            // Let params.preferred_lang override the hook if a caller really wants to
            const q = buildQuery(params, language_code);

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
        [endpoint, isSignedIn, language_code]
    );

    return { fetchUserEvents, isSignedIn, endpoint };
}

export async function fetchMyEvents(
    params: MyEventsSearchParams
): Promise<MyEventsResults> {
    // This remains a plain function (no hooks), so callers can still explicitly
    // pass preferred_lang into params when they have access to useLanguage().
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
    const lang = useLanguage().locale;
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
                const res = await api.get(
                    `${base}/${encodeURIComponent(instanceId)}`,
                    {
                        params: {
                            preferred_lang: lang,
                        },
                    }
                );
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
