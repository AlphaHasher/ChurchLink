// This is a file filled with absolutely disgusting but necessary logic for registration payment modals.
// It gets very complicated very fast.
// This is abstracted to its own quarantine zone for the convenience of the poor dev just trying to check simple UI in the modal.


import { useEffect, useMemo, useState, useCallback } from "react";
import { validateDiscountCodeForEvent } from "@/helpers/EventRegistrationHelper";

import type {
    UserFacingEvent,
    EventPaymentOption,
    EventPaymentType,
    ChangeEventRegistration,
    RegistrationChangeResponse,
    RegistrationDetails,
} from "@/shared/types/Event";
import type { ProfileInfo } from "@/shared/types/ProfileInfo";
import type { PersonDetails } from "@/shared/types/Person";

import { getAllPeople } from "@/helpers/UserHelper";
import { changeRegistration, createPaidRegistration } from "@/helpers/EventRegistrationHelper";
import { toast } from "react-toastify";

import type { AttendeeRow } from "@/features/eventsV2/components/EventAttendeesCard";

// -----------------------------
// Display helpers (exported so UI can reuse)
// -----------------------------
export const fmtDateTime = (iso?: string | null) =>
    iso
        ? new Date(iso).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        })
        : "—";

export const money = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);

// -----------------------------
// Local types (exported where useful to UI/consumers)
// -----------------------------
export type PaymentMethod = "free" | "door" | "paypal";
export type RegPhase = "open" | "not_open_yet" | "deadline_passed" | "closed";

type Registrant = {
    kind: "self" | "family";
    id: string | null;
    displayName: string;
    gender?: "M" | "F" | null;
    dateOfBirth?: Date | null;
    membership?: boolean | null;
};

// -----------------------------
// Pure utilities (logic only)
// -----------------------------
function getAgeOn(dateOfBirth?: Date | null, on?: Date): number | null {
    if (!dateOfBirth) return null;
    const ref = on ?? new Date();
    const dob = new Date(dateOfBirth);
    let age = ref.getFullYear() - dob.getFullYear();
    const m = ref.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
    return age;
}

function genderMatches(
    eventGender: UserFacingEvent["gender"],
    personGender?: "M" | "F" | null
): boolean {
    if (!eventGender || eventGender === "all") return true;
    if (!personGender) return false;
    return (
        (eventGender === "male" && personGender === "M") ||
        (eventGender === "female" && personGender === "F")
    );
}

function withinAgeRange(
    min?: number | null,
    max?: number | null,
    personAge?: number | null
): boolean {
    if (personAge == null) return !(typeof min === "number" || typeof max === "number");
    if (typeof min === "number" && personAge < min) return false;
    if (typeof max === "number" && personAge > max) return false;
    return true;
}

function eventIsFull(event: UserFacingEvent): boolean {
    const max = typeof event.max_spots === "number" ? event.max_spots : 0;
    const seats =
        typeof (event as any).seats_filled === "number" ? (event as any).seats_filled : 0;
    return max > 0 && seats >= max;
}

function requiresPayment(event: UserFacingEvent): boolean {
    const price = typeof event.price === "number" ? event.price : 0;
    const hasOptions = Array.isArray(event.payment_options) && event.payment_options.length > 0;
    return price > 0 && hasOptions;
}

function memberUnitPrice(event: UserFacingEvent, isMember: boolean | null | undefined) {
    const std = typeof event.price === "number" ? event.price : 0;
    const member = typeof event.member_price === "number" ? event.member_price! : null;
    if (isMember && typeof member === "number") return Math.max(0, member);
    return Math.max(0, std);
}

function requiresPaymentForUser(event: UserFacingEvent, isMember: boolean | null | undefined) {
    const hasOptions = Array.isArray(event.payment_options) && event.payment_options.length > 0;
    const priceForUser = memberUnitPrice(event, !!isMember);
    return hasOptions && priceForUser > 0;
}

// -----------------------------
// Hook
// -----------------------------
type HookArgs = {
    inline?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;

    instanceId: string;
    event: UserFacingEvent;

    allowedPaymentOptions?: EventPaymentOption[];

    onSuccess?: (method: PaymentMethod, resp?: RegistrationChangeResponse) => void;
    onError?: (msg: string) => void;
};

export function useRegistrationPaymentModalLogic({
    inline = false,
    open = false,
    onOpenChange,
    instanceId,
    event,
    allowedPaymentOptions,
    onSuccess,
    onError,
}: HookArgs) {
    // Household state
    const [loading, setLoading] = useState(false);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileInfo | null>(null);
    const [family, setFamily] = useState<PersonDetails[]>([]);

    // Initial registration snapshot from backend
    const initialSelfRegistered: boolean = Boolean(event.event_registrations?.self_registered);
    const initialFamilyRegistered: string[] = useMemo(
        () => event.event_registrations?.family_registered ?? [],
        [event.event_registrations]
    );
    const initialFamilyRegisteredSet = useMemo(
        () => new Set(initialFamilyRegistered),
        [initialFamilyRegistered]
    );
    const hasExistingReg: boolean = Boolean(event.has_registrations);

    // Standard flags
    // Whether THIS user needs to pay (member-aware)
    const isPaidEvent = useMemo(
        () => requiresPaymentForUser(event, profile?.membership ?? null),
        [event, profile?.membership]
    );

    // Helpful flag for UI copy: the event has a nonzero *standard* price
    const baseEventPaid = (typeof event.price === "number" ? event.price : 0) > 0;
    const payOptions = (allowedPaymentOptions ?? event.payment_options ?? []) as EventPaymentOption[];
    const now = new Date();
    const opensAt = event.registration_opens ? new Date(event.registration_opens) : null;
    const deadlineAt = event.registration_deadline ? new Date(event.registration_deadline) : null;
    const refundDeadlineAt = event.automatic_refund_deadline
        ? new Date(event.automatic_refund_deadline)
        : null;

    const full = eventIsFull(event);
    const regPhase: RegPhase = !event.registration_allowed
        ? "closed"
        : opensAt && now < opensAt
            ? "not_open_yet"
            : deadlineAt && now > deadlineAt
                ? "deadline_passed"
                : "open";

    // Household load
    useEffect(() => {
        const shouldLoad = inline ? true : !!open;
        if (!shouldLoad) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadErr(null);
            try {
                const res: any = await getAllPeople();
                if (cancelled) return;
                if (!res?.success) {
                    setLoadErr(res?.msg || "Failed to load your people.");
                    setLoading(false);
                    return;
                }
                setProfile(res.profile_info as ProfileInfo);
                setFamily(Array.isArray(res.family_members) ? res.family_members : []);
            } catch (e: any) {
                if (!cancelled) setLoadErr(e?.message || "Failed to load your people.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, inline]);

    // Refresh after add/edit/delete
    const refreshPeople = useCallback(async () => {
        try {
            const res: any = await getAllPeople();
            if (!res?.success) return;
            setProfile(res.profile_info as ProfileInfo);
            setFamily(Array.isArray(res.family_members) ? res.family_members : []);
        } catch {
            // ignore
        }
    }, []);

    // Event date used for “age at time of event”
    const eventDate = useMemo(
        () => new Date(event.date || (event as any).event_date || Date.now()),
        [event.date, (event as any).event_date]
    );

    // Unit price (member-aware)
    const unitPrice = useMemo(
        () => memberUnitPrice(event, profile?.membership ?? null),
        [event, profile?.membership]
    );

    // UI selection starts as the current registration
    const [selfSelected, setSelfSelected] = useState<boolean>(initialSelfRegistered);
    const [selectedFamily, setSelectedFamily] = useState<Record<string, boolean>>(
        Object.fromEntries((initialFamilyRegistered ?? []).map((id) => [id, true]))
    );

    // -------- Discount code state + math (used by Summary & submission) --------
    const [discountApplying, setDiscountApplying] = useState(false);
    const [discountErr, setDiscountErr] = useState<string | null>(null);
    const [discount, setDiscount] = useState<null | {
        id: string;
        is_percent: boolean;
        discount: number;
        uses_left: number | null;
    }>(null);

    // how many people we’re currently registering (affects averaging)
    const selectedCount = useMemo(() => {
        let n = 0;
        if (selfSelected) n += 1;
        for (const id of Object.keys(selectedFamily)) if (selectedFamily[id]) n += 1;
        return n;
    }, [selfSelected, selectedFamily]);


    function dropTwoDecimalPlaces(n: number) { return Math.trunc(n * 100) / 100; }

    function calcEffectiveUnit(unit: number, count: number) {
        if (!discount) return unit;

        if (!count) {
            count = 1;
        }

        const L = discount.uses_left == null ? count : Math.max(0, Math.min(count, discount.uses_left));
        if (L === 0) return unit;

        const perPersonAfter = discount.is_percent
            ? Math.max(0, dropTwoDecimalPlaces(unit * (1 - discount.discount / 100)))
            : Math.max(0, dropTwoDecimalPlaces(unit - Math.min(unit, discount.discount))); // cap discount at unit

        const total = dropTwoDecimalPlaces(perPersonAfter * L + unit * (count - L));
        return dropTwoDecimalPlaces(total / count);
    }

    // discounted unit used for Summary totals (header unit stays as base)
    const summaryUnitPrice = useMemo(
        () => calcEffectiveUnit(unitPrice, selectedCount),
        [unitPrice, selectedCount, discount]
    );

    // logic to validate or clear a code
    async function applyDiscountCode(rawCode: string) {
        setDiscountErr(null);
        const code = (rawCode || "").trim();
        if (!code) {
            setDiscount(null);
            return;
        }
        setDiscountApplying(true);
        try {
            const resp = await validateDiscountCodeForEvent({ event_id: event.event_id, discount_code: code });
            if (!resp?.success || !resp?.id) {
                setDiscount(null);
                setDiscountErr(resp?.msg || "This discount code is not valid for this event.");
                return;
            }
            setDiscount({
                id: resp.id,
                is_percent: !!resp.is_percent,
                discount: Number(resp.discount || 0),
                uses_left: resp.uses_left == null ? null : Number(resp.uses_left),
            });
        } catch {
            setDiscount(null);
            setDiscountErr("Could not validate discount code.");
        } finally {
            setDiscountApplying(false);
        }
    }
    function clearDiscountCode() {
        setDiscountErr(null);
        setDiscount(null);
    }

    // Payment method
    const [method, setMethod] = useState<PaymentMethod>(() =>
        isPaidEvent ? (payOptions.includes("paypal") ? "paypal" : "door") : "free"
    );
    const canUsePayPal = isPaidEvent && payOptions.includes("paypal");
    const canUseDoor = isPaidEvent && payOptions.includes("door");
    const isPayPal = method === "paypal";
    const isDoor = method === "door";

    // Re-init when modal opens or instance changes
    useEffect(() => {
        if (!open) return;
        setSelfSelected(initialSelfRegistered);
        setSelectedFamily(Object.fromEntries((initialFamilyRegistered ?? []).map((id) => [id, true])));
        setMethod(isPaidEvent ? (payOptions.includes("paypal") ? "paypal" : "door") : "free");
    }, [open, instanceId, initialSelfRegistered, initialFamilyRegistered, isPaidEvent, payOptions]);

    // Derived registrant rows for self/family (internal)
    const selfRow: Registrant | null = useMemo(() => {
        if (!profile) return null;
        const displayName =
            [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "You";
        return {
            kind: "self",
            id: null,
            displayName: `${displayName} (You)`,
            gender: (profile.gender || null) as "M" | "F" | null,
            dateOfBirth: profile.birthday ? new Date(profile.birthday) : null,
            membership: !!profile.membership,
        };
    }, [profile]);

    const familyRows: Registrant[] = useMemo(
        () =>
            (family || []).map((p) => ({
                kind: "family",
                id: p.id,
                displayName: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.id,
                gender: (p.gender || null) as "M" | "F" | null,
                dateOfBirth: p.date_of_birth ? new Date(p.date_of_birth) : null,
                membership: profile?.membership ?? null,
            })),
        [family, profile?.membership]
    );

    // Eligibility helpers (exposed via callbacks)
    function personEligibilityReasons(r: Registrant): string[] {
        const reasons: string[] = [];
        if (event.members_only && !r.membership) reasons.push("This event is for Members Only");
        if (!genderMatches(event.gender, r.gender ?? null)) {
            if (event.gender === "male") reasons.push("This event is for Men Only");
            else if (event.gender === "female") reasons.push("This event is for Women Only");
        }
        const age = getAgeOn(r.dateOfBirth, eventDate);
        const min = event.min_age;
        const max = event.max_age;
        const ageBad = !withinAgeRange(min, max, age);
        if (ageBad) {
            if (typeof min === "number" && typeof max === "number") {
                reasons.push(`This event is for Ages ${min}–${max}`);
            } else if (typeof min === "number") {
                reasons.push(`This event is for Ages ${min}+`);
            } else if (typeof max === "number") {
                reasons.push(`This event is for Ages ≤ ${max}`);
            }
        }
        return reasons;
    }

    function hardIneligible(r: Registrant): string | null {
        if (regPhase !== "open") return "Registration not open";
        if (full) return "Event full";
        const reasons = personEligibilityReasons(r);
        return reasons.length ? "Does not meet requirements" : null;
    }

    const selectedFamilyIds = useMemo(
        () => familyRows.filter((r) => selectedFamily[r.id!]).map((r) => r.id!) as string[],
        [familyRows, selectedFamily]
    );

    // Determine if no change
    const isNoop = useCallback(() => {
        const selfNoChange = Boolean(initialSelfRegistered) === Boolean(selfSelected);
        if (!selfNoChange) return false;
        if (initialFamilyRegisteredSet.size !== selectedFamilyIds.length) return false;
        for (const id of selectedFamilyIds) if (!initialFamilyRegisteredSet.has(id)) return false;
        return true;
    }, [initialSelfRegistered, selfSelected, initialFamilyRegisteredSet, selectedFamilyIds]);

    // Build delta body for backend
    const computeChangeBody = useCallback((): ChangeEventRegistration => {
        let self_registered: boolean | null = null;
        if (Boolean(initialSelfRegistered) !== Boolean(selfSelected)) {
            self_registered = selfSelected ? true : false;
        }

        const prev = initialFamilyRegisteredSet;
        const nowSet = new Set(selectedFamilyIds);

        const family_members_registering = [...nowSet].filter((id) => !prev.has(id));
        const family_members_unregistering = [...prev].filter((id) => !nowSet.has(id));

        let payment_type: EventPaymentType;
        const adding = self_registered === true || family_members_registering.length > 0;

        if (adding) {
            if (!isPaidEvent) payment_type = "free";
            else payment_type = isPayPal ? "paypal" : "door";
        } else {
            payment_type = "free";
        }

        return {
            event_instance_id: instanceId,
            self_registered,
            family_members_registering,
            family_members_unregistering,
            payment_type,
            discount_code_id: discount ? discount.id : null,
        };
    }, [
        initialSelfRegistered,
        selfSelected,
        initialFamilyRegisteredSet,
        selectedFamilyIds,
        instanceId,
        isPaidEvent,
        isPayPal,
        discount?.id,
    ]);

    function buildFinalDetails(): RegistrationDetails {
        const familyIds = Object.keys(selectedFamily).filter((id) => selectedFamily[id]);
        return {
            self_registered: !!selfSelected,
            family_registered: familyIds.filter((id) => id !== "SELF"),
            self_payment_details: null,
            family_payment_details: {},
        };
    }

    // Submit
    const [submitting, setSubmitting] = useState(false);

    const submitViaChange = useCallback(
        async (overridePaymentType?: EventPaymentType, opts?: { refundNowAmount?: number }) => {
            const base = computeChangeBody();
            const body = {
                ...base,
                ...(overridePaymentType != null ? { payment_type: overridePaymentType } : null),
                discount_code_id: discount?.id ?? base.discount_code_id,
            };

            const resp = await changeRegistration(body);
            if (!resp?.success) {
                alert(resp?.msg || "Could not update registration.");
                return false;
            }

            toast.success("Registration updated.");

            const amt = opts?.refundNowAmount ?? 0;
            if (amt > 0) {
                toast.success(`${money(amt)} PayPal refund processed.`);
            }

            onSuccess?.(
                (overridePaymentType as PaymentMethod) ?? (body.payment_type as PaymentMethod),
                resp
            );
            if (!inline) onOpenChange?.(false);
            return true;
        },
        [computeChangeBody, inline, onOpenChange, onSuccess, discount?.id]
    );

    const submitPaidCreate = useCallback(async () => {
        const base = computeChangeBody();
        const body = { ...base, payment_type: "paypal", discount_code_id: discount?.id ?? null };

        const addsExist =
            body.self_registered === true ||
            (body.family_members_registering && body.family_members_registering.length > 0);

        if (!addsExist) {
            toast.error("No new attendees selected to pay for.");
            return;
        }

        if (!canUsePayPal) {
            toast.error("Online payment is not available for this event.");
            return;
        }

        const res = await createPaidRegistration({ ...body, payment_type: "paypal" });
        if (!res?.success || !res.approve_url) {
            toast.error(res?.msg || "Could not start payment.");
            return;
        }

        const finalDetails = buildFinalDetails();
        sessionStorage.setItem(
            `paypal-final:${instanceId}:${res.order_id}`,
            JSON.stringify(finalDetails)
        );
        window.location.href = res.approve_url;
    }, [computeChangeBody, canUsePayPal, instanceId, discount?.id]);

    // Build attendees list for the card
    const attendeeRows: AttendeeRow[] = useMemo(() => {
        const rows: AttendeeRow[] = [];
        if (selfRow) {
            rows.push({
                id: "SELF",
                displayName: selfRow.displayName,
                gender: (selfRow.gender || null) as "M" | "F" | null,
                dateOfBirth: selfRow.dateOfBirth ? new Date(selfRow.dateOfBirth).toISOString() : null,
                isSelf: true,
                personPayload: {
                    id: "SELF",
                    first_name: profile?.first_name ?? null,
                    last_name: profile?.last_name ?? null,
                    date_of_birth: selfRow.dateOfBirth
                        ? new Date(selfRow.dateOfBirth).toISOString()
                        : null,
                    gender: (profile?.gender || null) as any,
                },
            });
        }
        for (const p of family) {
            const dobDate = p.date_of_birth ? new Date(p.date_of_birth as any) : null;
            const dobStr =
                p.date_of_birth == null
                    ? null
                    : typeof p.date_of_birth === "string"
                        ? p.date_of_birth
                        : dobDate?.toISOString() ?? null;

            rows.push({
                id: p.id,
                displayName: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.id,
                gender: (p.gender || null) as "M" | "F" | null,
                dateOfBirth: dobStr,
                isSelf: false,
                personPayload: {
                    id: p.id,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    date_of_birth: dobStr,
                    gender: (p.gender || null) as any,
                },
            });
        }
        return rows;
    }, [selfRow, family, profile?.first_name, profile?.last_name, profile?.gender]);

    // Payment info for a given row if currently registered
    function paymentInfoForRow(row: AttendeeRow) {
        const reg = event.event_registrations;
        if (!reg) return null;

        if (row.isSelf) {
            if (!initialSelfRegistered) return null;
            const d = reg.self_payment_details;
            if (!d) return { option: null, price: null, complete: null };
            return {
                option: (d.payment_type ?? null) as "free" | "door" | "paypal" | null,
                price: typeof d.price === "number" ? d.price : null,
                complete: typeof d.payment_complete === "boolean" ? d.payment_complete : null,
            };
        }

        if (!initialFamilyRegisteredSet.has(row.id)) return null;
        const d = reg.family_payment_details?.[row.id];
        if (!d) return { option: null, price: null, complete: null };
        return {
            option: (d.payment_type ?? null) as "free" | "door" | "paypal" | null,
            price: typeof d.price === "number" ? d.price : null,
            complete: typeof d.payment_complete === "boolean" ? d.payment_complete : null,
        };
    }

    function originalPaymentForRegistrantWithPrice(row: AttendeeRow):
        | { method: "free" | "door" | "paypal" | null; price: number | null; complete: boolean | null }
        | null {
        const reg = event.event_registrations;
        if (!reg) return null;

        if (row.isSelf) {
            if (!initialSelfRegistered) return null;
            const d = reg.self_payment_details;
            return {
                method: (d?.payment_type ?? null) as any,
                price: typeof d?.price === "number" ? d!.price : null,
                complete: d?.payment_complete ?? null,
            };
        }

        if (!initialFamilyRegisteredSet.has(row.id)) return null;
        const d = reg.family_payment_details?.[row.id];
        return {
            method: (d?.payment_type ?? null) as any,
            price: typeof d?.price === "number" ? d!.price : null,
            complete: d?.payment_complete ?? null,
        };
    }

    const hasAnyOrigPayPal = (() => {
        const reg = event.event_registrations;
        if (!reg) return false;
        if (reg.self_registered && reg.self_payment_details?.payment_type === "paypal") return true;
        for (const id of Object.keys(reg.family_payment_details || {})) {
            if (reg.family_payment_details![id]?.payment_type === "paypal") return true;
        }
        return false;
    })();

    const hasAnyOrigDoor = (() => {
        const reg = event.event_registrations;
        if (!reg) return false;
        if (reg.self_registered && reg.self_payment_details?.payment_type === "door") return true;
        for (const id of Object.keys(reg.family_payment_details || {})) {
            if (reg.family_payment_details![id]?.payment_type === "door") return true;
        }
        return false;
    })();

    // Money math

    const addSelf = selfSelected && !initialSelfRegistered ? 1 : 0;
    const addFamilies = selectedFamilyIds.filter((id) => !initialFamilyRegisteredSet.has(id)).length;
    const addsCount = addSelf + addFamilies;

    const removeSelf = !selfSelected && initialSelfRegistered ? 1 : 0;
    const removeFamilies = [...initialFamilyRegisteredSet].filter(
        (id) => !selectedFamilyIds.includes(id)
    ).length;
    const removesCount = removeSelf + removeFamilies;

    let payNow = 0;
    let refundNow = 0;

    let payAtDoor = 0;
    let creditAtDoor = 0;

    if (isPaidEvent && addsCount > 0) {
        if (isPayPal) {
            payNow += addsCount * summaryUnitPrice;
        } else if (isDoor) {
            payAtDoor += addsCount * summaryUnitPrice;
        }
    }

    if (isPaidEvent && removesCount > 0) {
        const rowsById = new Map(attendeeRows.map((r) => [r.id, r]));
        const removedRows: AttendeeRow[] = [];

        if (removeSelf && rowsById.has("SELF")) removedRows.push(rowsById.get("SELF")!);
        for (const id of initialFamilyRegisteredSet) {
            if (!selectedFamilyIds.includes(id) && rowsById.has(id)) removedRows.push(rowsById.get(id)!);
        }

        for (const row of removedRows) {
            const orig = originalPaymentForRegistrantWithPrice(row);
            if (!orig?.method) continue;

            const priceEach = typeof orig.price === "number" ? orig.price : unitPrice;

            if (orig.method === "paypal" && orig.complete) {
                refundNow += priceEach;
            } else if (orig.method === "door") {
                creditAtDoor += priceEach;
            } else {
                // free or unknown → no dollar movement
            }
        }
    }

    const netOnlineNow = payNow - refundNow;
    const netAtDoorLater = payAtDoor - creditAtDoor;

    const canUsePayPalOrPast = (isPaidEvent && (canUsePayPal || hasAnyOrigPayPal));
    const canUseDoorOrPast = (isPaidEvent && (canUseDoor || hasAnyOrigDoor));

    const showOnlineNow =
        canUsePayPalOrPast && (payNow !== 0 || refundNow !== 0 || isPayPal);

    const showDoorLater =
        canUseDoorOrPast && (payAtDoor !== 0 || creditAtDoor !== 0 || isDoor);

    const showGrand = showOnlineNow && showDoorLater && (netOnlineNow !== 0 || netAtDoorLater !== 0);

    const signMoney = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;

    const headerLabel = hasExistingReg ? "Change Registration" : "Register for Event";

    // Card helpers (exposed to UI so it doesn't inline closures)
    const disabledReasonFor = useCallback(
        (row: AttendeeRow) => {
            const initiallyRegistered = row.isSelf
                ? initialSelfRegistered
                : initialFamilyRegisteredSet.has(row.id);

            if (regPhase !== "open") {
                return initiallyRegistered ? null : "Registration not open";
            }

            if (eventIsFull(event) && !initiallyRegistered) {
                return "Event full";
            }

            if (!initiallyRegistered) {
                const r: Registrant = row.isSelf
                    ? (selfRow as Registrant)
                    : {
                        kind: "family",
                        id: row.id!,
                        displayName: row.displayName,
                        gender: row.gender ?? null,
                        dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
                        membership: profile?.membership ?? null,
                    };

                const reasons = personEligibilityReasons(r);
                if (reasons.length) return "Does not meet requirements";
            }

            return null;
        },
        [
            initialSelfRegistered,
            initialFamilyRegisteredSet,
            regPhase,
            event,
            selfRow,
            profile?.membership,
        ]
    );

    const personReasonsFor = useCallback(
        (row: AttendeeRow) => {
            const r: Registrant = row.isSelf
                ? (selfRow as Registrant)
                : {
                    kind: "family",
                    id: row.id!,
                    displayName: row.displayName,
                    gender: row.gender ?? null,
                    dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
                    membership: profile?.membership ?? null,
                };
            const reasons = personEligibilityReasons(r);
            const age = getAgeOn(r.dateOfBirth, eventDate);
            reasons.unshift(`Age at time of Event: ${age ?? "—"}`);
            return reasons;
        },
        [selfRow, profile?.membership, eventDate]
    );

    const onChangeFamilyFromIds = useCallback((ids: string[]) => {
        setSelectedFamily(Object.fromEntries(ids.map((id) => [id, true])));
    }, []);

    // high-level submit that mirrors original logic
    async function handleSubmit() {
        const base = computeChangeBody();
        const adding =
            base.self_registered === true ||
            (base.family_members_registering && base.family_members_registering.length > 0);

        if (adding) {
            const selfEligible =
                !!selfRow &&
                selfSelected &&
                !hardIneligible(selfRow) &&
                personEligibilityReasons(selfRow).length === 0;
            const famEligible = familyRows.some(
                (r) =>
                    selectedFamily[r.id!] &&
                    !hardIneligible(r) &&
                    personEligibilityReasons(r).length === 0
            );
            if (!selfEligible && !famEligible) {
                onError?.("Select at least one eligible registrant.");
                return;
            }
        }

        try {
            setSubmitting(true);
            if (isNoop()) {
                toast.error("No changes selected.");
                return;
            }

            if (!isPaidEvent) {
                await submitViaChange("free", { refundNowAmount: refundNow });
                return;
            }

            // If we’re adding and the discounted unit makes total due $0, treat as free
            const dueNow = isPaidEvent && isPayPal ? addsCount * summaryUnitPrice : 0;
            const dueAtDoor = isPaidEvent && isDoor ? addsCount * summaryUnitPrice : 0;
            const zeroDue = adding && (dueNow + dueAtDoor) === 0;

            if (zeroDue) {
                await submitViaChange("free", { refundNowAmount: refundNow });
                return;
            }

            if (isPayPal) {
                if (adding) {
                    await submitPaidCreate();
                } else {
                    await submitViaChange(undefined, { refundNowAmount: refundNow });
                }
                return;
            }

            await submitViaChange("door", { refundNowAmount: refundNow });
        } finally {
            setSubmitting(false);
        }
    }


    // Expose everything the UI needs (render only)
    return {
        loading,
        loadErr,
        profile,
        family,

        inline,
        open,

        initialSelfRegistered,
        initialFamilyRegisteredSet,
        hasExistingReg,

        isPaidEvent,
        baseEventPaid,
        payOptions,
        opensAt,
        deadlineAt,
        refundDeadlineAt,

        full,
        regPhase,

        eventDate,
        unitPrice,

        selfSelected,
        setSelfSelected,
        selectedFamily,
        setSelectedFamily,
        onChangeFamilyFromIds,

        method,
        setMethod,
        canUsePayPal,
        canUseDoor,
        isPayPal,
        isDoor,

        attendeeRows,
        disabledReasonFor,
        personReasonsFor,
        paymentInfoFor: paymentInfoForRow,
        refreshPeople,

        // money summary
        addSelf,
        addFamilies,
        addsCount,
        removeSelf,
        removeFamilies,
        removesCount,
        payNow,
        refundNow,
        netOnlineNow,
        payAtDoor,
        creditAtDoor,
        netAtDoorLater,
        showOnlineNow,
        showDoorLater,
        showGrand,
        signMoney,

        // actions
        submitting,
        handleSubmit,

        // labels
        headerLabel,

        // re-exported helpers for UI’s use
        requiresPayment,
        memberUnitPrice,
        eventIsFull,

        discountApplying,
        discountErr,
        discount,
        applyDiscountCode,
        clearDiscountCode,
        summaryUnitPrice,
    };
}
