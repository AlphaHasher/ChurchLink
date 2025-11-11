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
    AdminEventInstance,
    DiscountCode,
    DiscountCodeResponse,
    DiscountCodeUpdate,
    DiscountCodesListResponse,
    SetEventDiscountCodesResponse,
    EventDiscountCodesUpdate,
    ReadAdminPanelEvent,
    EventsWithDiscountResponse,
    DeleteDiscountCodeResponse,
    AdminRegistrationDetailsByUserResponse
} from "@/shared/types/Event";
import { convertEventsToUserTime, convertAdminEventInstancesToUserTime } from "./TimeFormatter";


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


export const fetchAdminPanelInstanceAssemblyById = async (
    instanceId: string,
    preferred_lang?: string | null
): Promise<AdminEventInstance | null> => {
    try {
        const params: Record<string, any> = {};
        if (preferred_lang) params.preferred_lang = preferred_lang;

        const res = await api.get(`/v1/events/admin-instance-assembly/${encodeURIComponent(instanceId)}`, { params });
        const data = res.data;

        if (!data?.success || !data?.instance) return null;

        const [converted] =
            convertAdminEventInstancesToUserTime([data.instance]) ?? [data.instance];
        return converted as AdminEventInstance;
    } catch (err) {
        console.error("Failed to fetch admin panel instance assembly by id:", err);
        return null;
    }
};


const OVERRIDE_GROUPS: Record<number, (keyof AdminEventInstanceOverrides)[]> = {
    1: ["localizations"],
    2: ["location_address"],
    3: ["image_id"],
    4: ["date"],
    5: [
        "rsvp_required",
        "registration_opens",
        "registration_deadline",
        "automatic_refund_deadline",
        "max_spots",
        "price",
        "member_price",
        "payment_options",
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

            if (key === "localizations" && v) {
                const map = v as Map<string, EventLocalization>;
                payload[key] = map instanceof Map ? Object.fromEntries(map.entries()) : (v as any);
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

export const fetchAllDiscountCodes = async (): Promise<DiscountCode[]> => {
    try {
        const res = await api.get("/v1/events/get-all-discount-codes");
        const data = res.data as DiscountCodesListResponse;
        if (!data?.success) return [];
        return data.codes ?? [];
    } catch (err) {
        console.error("Failed to fetch discount codes:", err);
        return [];
    }
};

export const fetchDiscountCodeById = async (codeId: string): Promise<DiscountCode | null> => {
    try {
        const res = await api.get(`/v1/events/${encodeURIComponent(codeId)}`);
        const data = res.data as DiscountCodeResponse;
        if (!data?.success || !data?.code) return null;
        return data.code;
    } catch (err) {
        console.error("Failed to fetch discount code by id:", err);
        return null;
    }
};

export const createDiscountCode = async (
    payload: DiscountCodeUpdate
): Promise<DiscountCodeResponse> => {
    try {
        const res = await api.post("/v1/events/create-discount-code", payload);
        return (res.data as DiscountCodeResponse) ?? { success: false, msg: "Unknown response" };
    } catch (err: any) {
        console.error("Failed to create discount code:", err);
        if (err?.response?.data) return err.response.data as DiscountCodeResponse;
        return { success: false, msg: "Unknown network error." };
    }
};

export const updateDiscountCode = async (
    codeId: string,
    payload: DiscountCodeUpdate
): Promise<DiscountCodeResponse> => {
    try {
        const res = await api.put(`/v1/events/discount-code/${encodeURIComponent(codeId)}`, payload);
        return (res.data as DiscountCodeResponse) ?? { success: false, msg: "Unknown response" };
    } catch (err: any) {
        console.error("Failed to update discount code:", err);
        if (err?.response?.data) return err.response.data as DiscountCodeResponse;
        return { success: false, msg: "Unknown network error." };
    }
};

export const setEventDiscountCodes = async (
    eventId: string,
    discountCodeIds: string[]
): Promise<SetEventDiscountCodesResponse> => {
    try {
        const payload: EventDiscountCodesUpdate = {
            event_id: eventId,
            discount_codes: discountCodeIds,
        };
        const res = await api.patch("/v1/events/change-discount-codes", payload);
        return (res.data as SetEventDiscountCodesResponse) ?? { success: false, msg: "Unknown response" };
    } catch (err: any) {
        console.error("Failed to set event discount codes:", err);
        if (err?.response?.data) return err.response.data as SetEventDiscountCodesResponse;
        return { success: false, msg: "Unknown network error." };
    }
};

export const fetchAdminEventsUsingDiscount = async (
    codeId: string,
    preferred_lang?: string | null
): Promise<ReadAdminPanelEvent[]> => {
    try {
        const params: Record<string, any> = {};
        if (preferred_lang) params.preferred_lang = preferred_lang;

        const res = await api.get(
            `/v1/events/get-events-with-discount/${encodeURIComponent(codeId)}`,
            { params }
        );
        const data = res.data as EventsWithDiscountResponse;

        if (!data?.success) return [];
        const items = data.events ?? [];
        return (convertEventsToUserTime(items) ?? items) as ReadAdminPanelEvent[];
    } catch (err) {
        console.error("Failed to fetch events using discount code:", err);
        return [];
    }
};

export const deleteDiscountCode = async (
    codeId: string
): Promise<DeleteDiscountCodeResponse> => {
    try {
        const res = await api.delete(
            `/v1/events/delete-discount-code/${encodeURIComponent(codeId)}`
        );
        return (res.data as DeleteDiscountCodeResponse) ?? {
            success: false,
            msg: "Unknown response",
        };
    } catch (err: any) {
        console.error("Failed to delete discount code:", err);
        if (err?.response?.data) return err.response.data as DeleteDiscountCodeResponse;
        return { success: false, msg: "Unknown network error." };
    }
};

export const fetchRegistrationDetailsByInstanceAndUser = async (
    instanceId: string,
    userId: string,
    preferred_lang?: string | null
): Promise<AdminRegistrationDetailsByUserResponse> => {
    try {
        if (!instanceId || !userId) {
            return { success: false, msg: "Missing instanceId or userId" };
        }

        const params: Record<string, any> = {};
        if (preferred_lang) params.preferred_lang = preferred_lang;

        const res = await api.get(
            `/v1/events/registration-details/${encodeURIComponent(instanceId)}/${encodeURIComponent(userId)}`,
            { params }
        );

        const data = (res?.data ?? {}) as AdminRegistrationDetailsByUserResponse;

        if (typeof data?.success !== "boolean") {
            return { success: false, msg: "Invalid response from server" };
        }

        if (data.success && data.event_instance) {
            const [converted] =
                convertAdminEventInstancesToUserTime([data.event_instance]) ?? [data.event_instance];
            data.event_instance = converted ?? data.event_instance;
        }

        return data;
    } catch (err) {
        console.error("Failed to fetch registration details by instance+user:", err);
        return { success: false, msg: "Network error fetching registration details" };
    }
};
