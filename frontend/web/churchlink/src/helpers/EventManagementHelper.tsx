import api from "../api/api";
import {
    AdminEventSearchParams,
    EventPagedResults,
    EventUpdate,
    AdminEventInstanceSearchParams,
    AdminEventInstancePagedResults,
    AdminPanelEvent,
    AdminEventInstanceOverrides,
    EventLocalization,
} from "@/shared/types/Event";
import { convertEventsToUserTime, convertAdminEventInstancesToUserTime } from "./TimeFormatter";

/* unchanged code above ... fetchPagedAdminPanelEvents / create / edit / delete / fetchById ... */

export const fetchPagedAdminPanelEvents = async (
    params: AdminEventSearchParams,
): Promise<EventPagedResults> => {
    try {
        const { ministries, ...rest } = params;

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

        const res = await api.get("/v1/events/admin-panel", { params: cleaned });
        const data = res.data;
        return {
            items: convertEventsToUserTime(data.items) ?? [],
            page: data.page ?? params.page,
            limit: data.limit ?? params.limit,
            total: data.total ?? 0,
            pages: data.pages ?? 0,
        };
    } catch (err) {
        console.error("Failed to fetch events:", err);
        return { items: [], page: 0, limit: 0, total: 0, pages: 0 };
    }
};

export const createAdminPanelEvent = async (event: EventUpdate) => {
    try {
        const payload = {
            ...event,
            localizations:
                event.localizations instanceof Map
                    ? Object.fromEntries(event.localizations.entries())
                    : event.localizations,
        };
        const res = await api.post("/v1/events/", payload);
        return res.data;
    } catch (err) {
        console.error("Failed to create event:", err);
        return { success: false, msg: "Failed to create event due to unknown error!" };
    }
};

export const editAdminPanelEvent = async (event: EventUpdate, id: string) => {
    try {
        const payload = {
            ...event,
            localizations:
                event.localizations instanceof Map
                    ? Object.fromEntries(event.localizations.entries())
                    : event.localizations,
        };
        const res = await api.put(`/v1/events/${id}`, payload);
        return res.data;
    } catch (err) {
        console.error("Failed to edit event:", err);
        return { success: false, msg: "Failed to edit event due to unknown error!" };
    }
};

export const deleteAdminPanelEvent = async (id: string) => {
    try {
        const res = await api.delete(`/v1/events/${id}`);
        return res.data;
    } catch (err) {
        console.error("Failed to delete event:", err);
        return { success: false, msg: "Failed to delete event due to unknown error!" };
    }
};

export const fetchPagedAdminPanelEventInstances = async (
    params: AdminEventInstanceSearchParams,
): Promise<AdminEventInstancePagedResults> => {
    try {
        const cleaned: Record<string, any> = {
            event_id: params.event_id,
            page: params.page,
            limit: params.limit,
            ...(params.status != null ? { status: params.status } : {}),
            ...(params.sort_by_series_index_asc != null
                ? { sort_by_series_index_asc: params.sort_by_series_index_asc }
                : {}),
            ...(params.preferred_lang ? { preferred_lang: params.preferred_lang } : {}),
        };

        Object.keys(cleaned).forEach((k) => {
            const v = cleaned[k];
            if (v === null || v === undefined || v === "") delete cleaned[k];
        });

        const res = await api.get("/v1/events/admin-instances", { params: cleaned });
        const data = res.data;

        return {
            items: convertAdminEventInstancesToUserTime(data.items) ?? [],
            page: data.page ?? params.page,
            limit: data.limit ?? params.limit,
            total: data.total ?? 0,
            pages: data.pages ?? 0,
        };
    } catch (err) {
        console.error("Failed to fetch event instances:", err);
        return { items: [], page: 0, limit: 0, total: 0, pages: 0 };
    }
};

export const fetchAdminPanelEventById = async (
    id: string,
    preferred_lang?: string | null,
): Promise<AdminPanelEvent | null> => {
    try {
        const params: Record<string, any> = {};
        if (preferred_lang) params.preferred_lang = preferred_lang;

        const res = await api.get(`/v1/events/admin-panel-by-id/${id}`, { params });
        const data = res.data;

        if (!data?.success || !data?.event) return null;

        const [converted] = convertEventsToUserTime([data.event]) ?? [data.event];
        return converted as AdminPanelEvent;
    } catch (err) {
        console.error("Failed to fetch admin panel event by id:", err);
        return null;
    }
};

/* -------------------- Instance overrides (no invented types) -------------------- */

// group → field keys (must match backend grouping)
const OVERRIDE_GROUPS: Record<number, (keyof AdminEventInstanceOverrides)[]> = {
    1: ["localizations"],
    2: ["location_url"],
    3: ["image_id"],
    4: ["date"],
    5: [
        "rsvp_required",
        "registration_opens",
        "registration_deadline",
        "max_spots",
        "price",
        "member_price",
        "payment_options",
        "refund_policy",
    ],
    6: ["members_only", "gender", "min_age", "max_age"],
    7: ["registration_allowed", "hidden"],
};

// groupsOn keys are 1..7 (local UI runtime, not exported)
export type OverridesGroupsOn = Record<number, boolean>;

/** Build a backend payload that only contains fields for groups that are ON, and skips undefined. */
export function buildInstanceOverridesPayload(
    draft: AdminEventInstanceOverrides,
    groupsOn: OverridesGroupsOn
): Record<string, any> {
    const payload: Record<string, any> = {};

    for (const groupNo of Object.keys(OVERRIDE_GROUPS)) {
        const n = Number(groupNo);
        if (!groupsOn[n]) continue;
        for (const key of OVERRIDE_GROUPS[n]) {
            const v = draft[key];
            if (v === undefined) continue;

            // normalize
            if (key === "localizations" && v) {
                // Map<string, EventLocalization> -> plain object with complete values
                const map = v as Map<string, EventLocalization>;
                const obj =
                    map instanceof Map ? Object.fromEntries(map.entries()) : (v as any);
                payload[key] = obj;
                continue;
            }

            payload[key] = v;
        }
    }

    return payload;
}

/** PUT instance overrides for a specific event occurrence (by seriesIndex). */
export async function updateEventInstanceOverrides(
    eventId: string,
    seriesIndex: number,
    draft: AdminEventInstanceOverrides,
    groupsOn: OverridesGroupsOn
): Promise<{ success: boolean; msg?: string }> {
    try {
        const payload = buildInstanceOverridesPayload(draft, groupsOn);

        console.log('PAYLOAD BELOW');
        console.log(payload);

        const res = await api.put(
            `/v1/events/override/${encodeURIComponent(eventId)}/${seriesIndex}`,
            payload
        );

        return res.data ?? { success: true };
    } catch (err: any) {
        console.error("Failed to update event instance overrides:", err);
        if (err?.response?.data) return err.response.data;
        return { success: false, msg: "Unknown network error." };
    }
}
