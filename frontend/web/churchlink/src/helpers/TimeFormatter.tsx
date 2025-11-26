// This file is mainly due to correcting a bane of my existence: Daylight Savings Time related bugs.

import { TransactionSummary } from "@/shared/types/Transactions";

export type MaybeISO = string | null | undefined;

const ADMIN_TZ = import.meta.env.VITE_ADMIN_TZ ?? "America/Los_Angeles";


// Returns a specifically UTC date if no timezone specified in ISO
function assumeUTCIfNaive(iso: MaybeISO): string | null {
    if (!iso) return null;
    const s = String(iso);
    // If it already has a zone marker (Z or ±hh:mm), leave it.
    if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) return s;
    return s + "Z";
}


// A function that creates a date instance from an ISO string
function dateFromISO(iso: MaybeISO): Date | null {
    const norm = assumeUTCIfNaive(iso);
    if (!norm) return null;
    const d = new Date(norm);
    return isNaN(d.getTime()) ? null : d;
}


// A function to simply convert a UTC iso to the user timezone
function toZonedISOString(utcISO: MaybeISO): MaybeISO {
    const d = dateFromISO(utcISO);
    return d ? d.toISOString() : utcISO ?? null;
}

// Returns true if the given UTC instant falls within Daylight Saving Time for the specified IANA timezone.
export function isDstAt(utcIso: string, timeZone: string): boolean {
    try {
        const instant = new Date(utcIso);
        if (isNaN(instant.getTime())) return false;

        // Compute timezone offset (in minutes) for a given UTC Date and IANA zone.
        // Positive result means local time is ahead of UTC, negative means behind.
        const zoneOffsetMinutes = (d: Date): number => {
            const dtf = new Intl.DateTimeFormat("en-US", {
                timeZone,
                hour12: false,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
            const parts = dtf.formatToParts(d);
            const get = (t: Intl.DateTimeFormatPartTypes) =>
                Number(parts.find((p) => p.type === t)!.value);
            // Interpret the formatted local clock time as if it were UTC to back out the offset
            const asUTC = Date.UTC(
                get("year"),
                get("month") - 1,
                get("day"),
                get("hour"),
                get("minute"),
                get("second")
            );
            return (asUTC - d.getTime()) / 60000;
        };

        const year = instant.getUTCFullYear();
        const jan = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        const jul = new Date(Date.UTC(year, 6, 1, 0, 0, 0));

        const janOff = zoneOffsetMinutes(jan);
        const julOff = zoneOffsetMinutes(jul);

        // If offsets match, the zone doesn't observe DST this year
        if (janOff === julOff) return false;

        // Infer hemisphere: in northern zones, Jan has standard time; in southern, Jul has standard time.
        const northernHemisphere = janOff < julOff;
        const standardOffset = northernHemisphere ? janOff : julOff;

        // If the current offset differs from the inferred standard offset, we're in DST.
        return zoneOffsetMinutes(instant) !== standardOffset;
    } catch {
        // Invalid timezone or other Intl errors
        return false;
    }
}


// A function that handles time conversion based on an event time, time of editor updating, and editor tz
// Custom wrote this based on just trying to rationalize the problem
// It uses event_time and anchor_time
// It can be any arbitrary two times, but essentially event_time is when it actually takes place and anchor time is the "point of reference"
// Anchor time is some sort of truth of a known intention
// (This is because the bug applies the hardest via recurrences since a recurrence can be -7 or -8 but a specific instance we know what it is)
// Therefore anchor times should be a time that the user SPECIFICALLY set at a time with intention
// Event times are recurrences built off that
// Adds offsets of +/- based off intentions of DST being active during the anchor time or not.
function convertTime(
    event_time: MaybeISO,
    anchor_time: MaybeISO,
) {

    // Set reference TZ to the Admin Tz
    const tz = ADMIN_TZ;

    // Get an event date object in advance
    const event = dateFromISO(event_time);

    // Snatch UTC ISO's for the event date and anchor date
    const utc_event = assumeUTCIfNaive(event_time);
    const utc_anchor = assumeUTCIfNaive(anchor_time);

    // If any of our 3 assemblies fail, return early
    if (!event) {
        return event_time;
    }

    if (!utc_event) {
        return event_time;
    }

    if (!utc_anchor) {
        return event_time;
    }

    // Check to see if the event and the anchor happened during DST for the admin tz
    const is_event_dst = isDstAt(utc_event, tz);
    const is_anchor_dst = isDstAt(utc_anchor, tz);

    // Initialize a delta to 0
    var delta = 0;

    // If the event is in DST and the anchor is not, it means that the intended time will be 1 hour too late post-UTC conversion, so we set delta to -1 hour
    if (is_event_dst && !is_anchor_dst) {
        delta = -1;
    }

    // If the anchor is in DST and the event is not, it means that the intended time will be 1 hour too early post UTC-conversion, so we set delta to 1 hour
    if (!is_event_dst && is_anchor_dst) {
        delta = 1;
    }


    // Create a new date with an offset of delta hours
    const adjusted = new Date(event.getTime() + delta * 3600_000);

    // Apply admin tz
    return adjusted.toLocaleString("en-US", { timeZone: tz });
}

// Converts strings like "11/13/2025, 5:47:00 PM" (en-US, ADMIN_TZ wall time)
// into a UTC ISO string (e.g. "2025-11-14T01:47:00.000Z").
// Returns null if it can’t parse.
export function localeEnUSToISOInAdminTz(input: string | null | undefined): string | null {
    if (!input) return null;
    const s = String(input).trim();
    // Matches: M/D/YYYY, H:MM[:SS] AM|PM   (spaces flexible)
    const re = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
    const m = s.match(re);
    if (!m) return null;

    let [, M, D, YYYY, hh, mm, ss, ap] = m;
    const year = Number(YYYY);
    const month = Number(M);   // 1-12
    const day = Number(D);     // 1-31
    let hour = Number(hh);     // 1-12
    const minute = Number(mm);
    const second = ss ? Number(ss) : 0;

    // 12h -> 24h
    const isPM = ap.toUpperCase() === "PM";
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    // Initial UTC guess assuming the wall-time values are UTC (they're not).
    // We'll fix it using the actual offset of ADMIN_TZ at that instant.
    const initialUTC = Date.UTC(year, month - 1, day, hour, minute, second);

    // Compute the timezone offset (in minutes) for ADMIN_TZ at that UTC instant.
    const offsetMin = zoneOffsetMinutes(new Date(initialUTC), ADMIN_TZ);

    // True UTC instant is local wall-time minus the zone offset.
    const trueUTC = initialUTC - offsetMin * 60_000;

    const d = new Date(trueUTC);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Returns the zone offset in minutes for `timeZone` at the given UTC Date.
 * Positive => local time is ahead of UTC; negative => behind UTC.
 * (Same technique used elsewhere in this file to derive offsets without libs.)
 */
function zoneOffsetMinutes(dUTC: Date, timeZone: string): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const parts = dtf.formatToParts(dUTC);
    const get = (t: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((p) => p.type === t)!.value);
    // Interpret the formatted local clock time as if it were UTC to back out the offset
    const asUTC = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second")
    );
    return (asUTC - dUTC.getTime()) / 60000;
}

// -------------------------------------------------------------------
// |    CONVERTER FUNCTIONS                                          |
// -------------------------------------------------------------------

export function convertEventsToUserTime<T extends {
    date?: MaybeISO;
    registration_opens?: MaybeISO;
    registration_deadline?: MaybeISO;
    automatic_refund_deadline?: MaybeISO;
    updated_on?: MaybeISO;
    end_date?: MaybeISO;
}>(events: T[]): T[] {
    return events.map((e) => {
        return {
            ...e,
            date: toZonedISOString(e.date) as string,
            registration_opens: toZonedISOString(e.registration_opens) as string,
            registration_deadline: toZonedISOString(e.registration_deadline) as string,
            automatic_refund_deadline: toZonedISOString(e.automatic_refund_deadline) as string,
            updated_on: toZonedISOString(e.updated_on) as string,
            end_date: toZonedISOString(e.end_date) as string,
        };
    });
}


export function convertAdminEventInstancesToUserTime<T extends {
    date?: MaybeISO;
    end_date?: MaybeISO;
    registration_opens?: MaybeISO;
    registration_deadline?: MaybeISO;
    automatic_refund_deadline?: MaybeISO
    target_date?: MaybeISO;
    updated_on?: MaybeISO;
    overrides_date_updated_on?: MaybeISO;
    event_date?: MaybeISO
    overrides_tracker?: boolean[];
}>(items: T[]): T[] {
    return items.map((e) => {

        var date_ref = e.event_date;
        var end_date_ref = e.event_date;
        var op_ref = e.event_date;
        var dl_ref = e.event_date;
        var rdl_ref = e.event_date;

        if (e.overrides_tracker != null) {
            if (e.overrides_tracker.length > 3) {
                if (e.overrides_tracker[3]) {
                    date_ref = e.date;
                    end_date_ref = e.end_date;
                }

                if (e.overrides_tracker.length > 4) {
                    if (e.overrides_tracker[4]) {
                        op_ref = e.registration_opens;
                        dl_ref = e.registration_deadline;
                        rdl_ref = e.automatic_refund_deadline
                    }
                }
            }
        }

        return {
            ...e,
            // Keep the scheduled local time stable for the instance
            date: convertTime(e.date, date_ref) as string,
            end_date: convertTime(e.end_date, end_date_ref) as string,

            // Target date belongs to the event’s recurrence math (anchor to event)
            target_date: convertTime(e.target_date, e.event_date) as string,

            // Registration windows are event-level fields
            registration_opens: convertTime(e.registration_opens, op_ref),
            registration_deadline: convertTime(e.registration_deadline, dl_ref),
            automatic_refund_deadline: convertTime(e.automatic_refund_deadline, rdl_ref),

            // Normalize anchors
            updated_on: toZonedISOString(e.updated_on) as string,
            event_date: toZonedISOString(e.event_date) as string,
            overrides_date_updated_on: toZonedISOString(e.overrides_date_updated_on) as string,
        };
    });
}


export function convertUserFacingEventsToUserTime<T extends {
    date?: MaybeISO;
    end_date?: MaybeISO;
    registration_opens?: MaybeISO;
    registration_deadline?: MaybeISO;
    automatic_refund_deadline?: MaybeISO;
    updated_on?: MaybeISO;
    overrides_date_updated_on?: MaybeISO;
    event_date?: MaybeISO;
    overrides_tracker?: boolean[];
}>(items: T[]): T[] {
    return items.map((e) => {

        var date_ref = e.event_date;
        var end_date_ref = e.event_date;
        var op_ref = e.event_date;
        var dl_ref = e.event_date;
        var rdl_ref = e.event_date;

        if (e.overrides_tracker != null) {
            if (e.overrides_tracker.length > 3) {
                if (e.overrides_tracker[3]) {
                    date_ref = e.date;
                    end_date_ref = e.end_date;
                }

                if (e.overrides_tracker.length > 4) {
                    if (e.overrides_tracker[4]) {
                        op_ref = e.registration_opens;
                        dl_ref = e.registration_deadline;
                        rdl_ref = e.automatic_refund_deadline
                    }
                }
            }
        }

        return {
            ...e,
            date: convertTime(e.date, date_ref) as string,
            end_date: convertTime(e.end_date, end_date_ref) as string,
            registration_opens: convertTime(e.registration_opens, op_ref),
            registration_deadline: convertTime(e.registration_deadline, dl_ref),
            automatic_refund_deadline: convertTime(e.automatic_refund_deadline, rdl_ref),
            updated_on: toZonedISOString(e.updated_on) as string,
            event_date: toZonedISOString(e.event_date) as string,
            overrides_date_updated_on: toZonedISOString(e.overrides_date_updated_on) as string,
        };
    });
}

export function convertSisterInstanceIdentifiersToUserTime<T extends {
    date?: MaybeISO;
    updated_on?: MaybeISO;
    event_date?: MaybeISO;
}>(items: T[]): T[] {
    return items.map((e) => {

        return {
            ...e,
            date: convertTime(e.date, e.event_date) as string,
            updated_on: toZonedISOString(e.updated_on) as string,
            event_date: toZonedISOString(e.event_date) as string,
        };
    });
}

export function convertTransactionSummaryToUserTime<T extends {
    created_at?: MaybeISO;
    updated_at?: MaybeISO
}>(sums: T[]): T[] {
    return sums.map((e) => {
        return {
            ...e,
            created_at: toZonedISOString(e.created_at) as string,
            updated_at: toZonedISOString(e.updated_at) as string,
        };
    });
}
export { convertTransactionSummaryToUserTime as convertMinistryToUserTime };

export function convertMembershipRequestToUserTime<T extends {
    created_on?: MaybeISO;
    responded_to?: MaybeISO
}>(sums: T[]): T[] {
    return sums.map((e) => {
        return {
            ...e,
            created_on: toZonedISOString(e.created_on) as string,
            responded_to: toZonedISOString(e.responded_to) as string,
        };
    });
}


export function convertFormResponsesToUserTime<T extends {
    submitted_at?: MaybeISO;
}>(sums: T[]): T[] {
    return sums.map((e) => {
        return {
            ...e,
            submitted_at: toZonedISOString(e.submitted_at) as string,
        };
    });
}


export function convertRefundRequestsToUserTime<T extends {
    transaction?: TransactionSummary | null;
    created_on?: MaybeISO;
    responded_to?: MaybeISO;
}>(items: T[]): T[] {
    return items.map((e) => {
        const tx = e.transaction ?? null;

        let convertedTx: TransactionSummary | null = null;
        if (tx) {
            const [first] = convertTransactionSummaryToUserTime([tx]) as TransactionSummary[];
            convertedTx = first ?? null;
        }

        return {
            ...e,
            transaction: convertedTx,
            created_on: toZonedISOString(e.created_on) as string,
            responded_to: toZonedISOString(e.responded_to) as string,
        };
    });
}

export function convertFinancialReportsToUserTime<T extends {
    created_at?: MaybeISO;
    config?: {
        created_from?: MaybeISO;
        created_to?: MaybeISO;
        [key: string]: any;
    } | null;
}>(items: T[]): T[] {
    return items.map((e) => {
        const cfg = e.config ?? null;

        const convertedConfig = cfg
            ? {
                ...cfg,
                created_from: toZonedISOString(cfg.created_from) as string,
                created_to: toZonedISOString(cfg.created_to) as string,
            }
            : cfg;

        return {
            ...e,
            created_at: toZonedISOString(e.created_at) as string,
            config: convertedConfig,
        };
    });
}



