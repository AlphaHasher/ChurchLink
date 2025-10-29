import { AdminEventInstance, ReadAdminPanelEvent, UserFacingEvent } from "@/shared/types/Event";

type MaybeISO = string | null | undefined;

/** "+HH:MM" or "-HH:MM" from minutes */
const formatOffset = (offsetMinutes: number) => {
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    return `${sign}${hh}:${mm}`;
};

/** If no timezone info is present, assume UTC. */
const assumeUTCIfNaive = (s: string): string => {
    const t = s.trim();
    // date-only
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t}T00:00:00Z`;
    // already has Z or ±HH:MM
    if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(t)) return t;
    // ISO-like without zone → make it UTC
    return `${t}Z`;
};

/** Extract y/m/d/H/M/S for an instant rendered in a target zone */
const getPartsInZone = (date: Date, timeZone: string) => {
    const dtf = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const map: Record<string, string> = {};
    for (const p of dtf.formatToParts(date)) {
        if (p.type !== "literal") map[p.type] = p.value;
    }
    const y = Number(map.year);
    const m = Number(map.month);
    const d = Number(map.day);
    const H = Number(map.hour);
    const M = Number(map.minute);
    const S = Number(map.second);
    return { y, m, d, H, M, S };
};

/** Minutes east of UTC for how this instant is interpreted in the given zone */
const getOffsetMinutesInZone = (inst: Date, timeZone: string): number => {
    const { y, m, d, H, M, S } = getPartsInZone(inst, timeZone);
    const localLikeUTC = Date.UTC(y, m - 1, d, H, M, S);
    const actualUTC = inst.getTime();
    return Math.round((localLikeUTC - actualUTC) / 60000);
};

/**
 * Convert a (UTC) ISO string to an ISO string in a target IANA zone.
 * If the input lacks timezone info, it is treated as UTC.
 */
export const toZonedISOString = (utcISO: MaybeISO, timeZone: string): MaybeISO => {
    if (!utcISO) return utcISO;

    // Normalize: treat naive as UTC, preserve explicit zones
    const normalized = assumeUTCIfNaive(utcISO);
    const inst = new Date(normalized);
    if (isNaN(inst.getTime())) return utcISO;

    const offsetMinutes = getOffsetMinutesInZone(inst, timeZone);

    const { y, m, d, H, M, S } = getPartsInZone(inst, timeZone);
    const yyyy = String(y);
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const hh = String(H).padStart(2, "0");
    const mi = String(M).padStart(2, "0");
    const ss = String(S).padStart(2, "0");
    const offset = formatOffset(offsetMinutes);

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${offset}`;
};

/**
 * DST-stable conversion: keep the *wall-clock* time consistent with how it looked
 * at `baselineISO` (typically row.updated_on). If DST changed since then,
 * shift the instant by the offset delta before producing a zoned ISO.
 */
export const toZonedISOStringStableWall = (
    utcISO: MaybeISO,
    baselineISO: MaybeISO,
    timeZone: string
): MaybeISO => {
    if (!utcISO) return utcISO;

    const normalized = assumeUTCIfNaive(utcISO);
    const inst = new Date(normalized);
    if (isNaN(inst.getTime())) return utcISO;

    // If we don't have a baseline, fall back to regular conversion.
    if (!baselineISO) return toZonedISOString(utcISO, timeZone);

    const base = new Date(assumeUTCIfNaive(baselineISO));
    if (isNaN(base.getTime())) return toZonedISOString(utcISO, timeZone);

    const baseOffset = getOffsetMinutesInZone(base, timeZone);
    const occOffset = getOffsetMinutesInZone(inst, timeZone);
    const deltaMinutes = baseOffset - occOffset;

    const adjusted = new Date(inst.getTime() + deltaMinutes * 60_000);
    return toZonedISOString(adjusted.toISOString(), timeZone);
};

/** Human-readable formatter in a zone (naive inputs assumed UTC) */
export const formatInZone = (
    utcISO: MaybeISO,
    timeZone: string,
    opts: Intl.DateTimeFormatOptions = {}
): MaybeISO => {
    if (!utcISO) return utcISO;
    const normalized = assumeUTCIfNaive(utcISO);
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return utcISO;
    return new Intl.DateTimeFormat(undefined, {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
        ...opts,
    }).format(d);
};

/* -------------------------------------------------------------------------- */
/*  End-to-end converters used by EventManagementHelper and fetchers          */
/*  These apply DST-stable logic (baseline = updated_on) so that              */
/*  "7:40 PM" remains 7:40 PM across DST transitions when hydrated.           */
/* -------------------------------------------------------------------------- */

export const convertEventsToUserTime = (
    events: ReadAdminPanelEvent[],
    userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): ReadAdminPanelEvent[] => {
    return events.map((e) => ({
        ...e,
        // lock wall time to the admin's last update intent
        date: toZonedISOStringStableWall(e.date, e.updated_on, userTimeZone) as string,
        registration_opens: toZonedISOStringStableWall(
            e.registration_opens,
            e.updated_on,
            userTimeZone
        ),
        registration_deadline: toZonedISOStringStableWall(
            e.registration_deadline,
            e.updated_on,
            userTimeZone
        ),
        // updated_on itself is just a point-in-time display
        updated_on: toZonedISOString(e.updated_on, userTimeZone) as string,
    }));
};

export const convertAdminEventInstancesToUserTime = (
    events: AdminEventInstance[],
    userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): AdminEventInstance[] => {
    return events.map((e) => ({
        ...e,
        date: toZonedISOStringStableWall(e.date, e.overrides_date_updated_on, userTimeZone) as string,
        registration_opens: toZonedISOStringStableWall(
            e.registration_opens,
            e.updated_on,
            userTimeZone
        ),
        registration_deadline: toZonedISOStringStableWall(
            e.registration_deadline,
            e.updated_on,
            userTimeZone
        ),
        target_date: toZonedISOStringStableWall(
            e.target_date,
            e.updated_on,
            userTimeZone
        ) as string,
        updated_on: toZonedISOString(e.updated_on, userTimeZone) as string,
        overrides_date_updated_on: toZonedISOString(e.overrides_date_updated_on, userTimeZone) as string,
    }));
};

export const convertUserFacingEventsToUserTime = (
    events: UserFacingEvent[],
    userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): UserFacingEvent[] => {
    return events.map((e) => ({
        ...e,
        date: toZonedISOStringStableWall(e.date, e.overrides_date_updated_on, userTimeZone) as string,
        registration_opens: toZonedISOStringStableWall(
            e.registration_opens,
            e.updated_on,
            userTimeZone
        ),
        registration_deadline: toZonedISOStringStableWall(
            e.registration_deadline,
            e.updated_on,
            userTimeZone
        ),
        updated_on: toZonedISOString(e.updated_on, userTimeZone) as string,
        overrides_date_updated_on: toZonedISOString(e.overrides_date_updated_on, userTimeZone) as string,
    }));
};
