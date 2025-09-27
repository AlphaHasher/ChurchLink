import { api } from "@/api";

// ==== Types ====

export type NotificationActionType = "text" | "link" | "event" | "route";
export type NotificationTarget = "all" | "logged_in" | "anonymous";

export interface NotificationSettingsResponse {
    streamNotificationMessage?: string;
    streamNotificationTitle?: string;
    YOUTUBE_TIMEZONE?: string;
    envOverride?: boolean;
    [k: string]: unknown;
}

export interface ScheduleNotificationPayload {
    title: string;
    body: string;
    scheduled_time: string;
    target: NotificationTarget;
    actionType: NotificationActionType;
    link?: string;
    eventId?: string;
    route?: string;
    data?: Record<string, unknown>;
}

export interface ScheduledNotification {
    _id: string;
    title: string;
    body: string;
    scheduled_time?: string; // ISO
    sent?: boolean;
    canceled?: boolean;
    link?: string;
    data?: Record<string, unknown>;
    [k: string]: unknown;
}

export interface HistoryNotification {
    id?: string | number;
    _id?: string;
    title: string;
    message?: string;
    body?: string;
    link?: string;
    route?: string;
    actionType?: NotificationActionType;
    recipients?: unknown[];
    sent_at?: string;
    scheduled_time?: string;
    timestamp?: string;
    data?: Record<string, unknown>;
    [k: string]: unknown;
}

// ==== API ====

export const getNotificationSettings = async (): Promise<NotificationSettingsResponse> => {
    const res = await api.get<NotificationSettingsResponse>("/v1/notification/settings");
    return res.data ?? {};
};

export const saveNotificationSettings = async (params: {
    streamNotificationTitle: string;
    streamNotificationMessage: string;
}) => {
    const res = await api.post("/v1/notification/settings", params, {
        headers: { "Content-Type": "application/json" },
    });
    return res.data;
};

export const getScheduledNotifications = async (): Promise<ScheduledNotification[]> => {
    const res = await api.get<ScheduledNotification[]>("/v1/notification/scheduled");
    return Array.isArray(res.data) ? res.data : [];
};

export const getNotificationHistory = async (): Promise<HistoryNotification[]> => {
    const res = await api.get<HistoryNotification[]>("/v1/notification/history");
    return Array.isArray(res.data) ? res.data : [];
};

export const scheduleNotification = async (payload: ScheduleNotificationPayload) => {
    const res = await api.post("/v1/notification/schedule", payload, {
        headers: { "Content-Type": "application/json" },
    });
    return res;
};

export interface SendNotificationPayload {
    title: string;
    body: string;
    target?: NotificationTarget;
    actionType?: NotificationActionType;
    link?: string;
    eventId?: string;
    route?: string;
    data?: Record<string, unknown>;
}

export const sendNotificationNow = async (payload: SendNotificationPayload) => {
    const res = await api.post("/v1/notification/send", {
        ...payload,
        send_to_all: true,
        data: {
            target: payload.target || "all",
            ...payload.data
        }
    }, {
        headers: { "Content-Type": "application/json" },
    });
    return res;
};

export const deleteScheduledNotification = async (id: string) => {
    const res = await api.delete(`/v1/notification/scheduled/${encodeURIComponent(id)}`);
    return res.status === 200 || res.status === 204;
};

// ==== Utils ====

// Convert a local date+time specified in an IANA timezone into an ISO UTC string.
// Fallbacks to “Z” suffix construction if the TZ conversion fails.
export const tzDateTimeToUTCISO = (dateYYYYMMDD: string, timeHHMM: string, timeZone: string): string => {
    try {
        const localIso = `${dateYYYYMMDD}T${timeHHMM}:00`;
        const tzDate = new Date(
            new Date(localIso).toLocaleString("en-US", { timeZone })
        );
        return tzDate.toISOString();
    } catch {
        return `${dateYYYYMMDD}T${timeHHMM}:00Z`;
    }
};
