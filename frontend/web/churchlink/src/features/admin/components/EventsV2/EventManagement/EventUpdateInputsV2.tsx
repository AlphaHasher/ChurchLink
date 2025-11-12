import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Separator } from "@/shared/components/ui/separator";
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/shared/components/ui/select";
import {
    Popover, PopoverTrigger, PopoverContent,
} from "@/shared/components/ui/popover";
import {
    Command, CommandInput, CommandEmpty, CommandList, CommandGroup, CommandItem,
} from "@/shared/components/ui/command";
import { Calendar } from "@/shared/components/ui/calendar";
import { EventImageSelector } from "@/features/admin/components/Events/EventImageSelector";
import { localizationNameToCode } from "@/shared/dictionaries/LocalizationDicts";

import type {
    EventUpdate,
    EventLocalization,
    EventRecurrence,
    EventGenderOption,
    EventPaymentOption,
} from "@/shared/types/Event";
import type { Ministry } from "@/shared/types/Ministry";


const paymentChoices: EventPaymentOption[] = ["paypal", "door"];
const recurrences: EventRecurrence[] = ["never", "daily", "weekly", "monthly", "yearly"];

function toRecordFromMap(
    m?: Map<string, EventLocalization> | Record<string, EventLocalization> | null,
): Record<string, EventLocalization> {
    if (!m) return {};
    if (m instanceof Map) return Object.fromEntries(m.entries());
    return m;
}
function toMapFromRecord(r: Record<string, EventLocalization>): Map<string, EventLocalization> {
    return new Map(Object.entries(r));
}
function codeToLanguageName(code: string) {
    for (const [name, c] of Object.entries(localizationNameToCode)) {
        if (c === code) return name;
    }
    return code;
}
function dateLabel(iso?: string | null) {
    if (!iso) return "Pick date";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Pick date";
    return d.toLocaleString();
}

type Props = {
    value?: Partial<EventUpdate>;
    initial?: Partial<EventUpdate>;
    onChange?: (draft: EventUpdate) => void;

    allMinistries: Ministry[];
    disabled?: boolean;

    preferredLangCode?: string;
};

export default function EventUpdateInputsV2({
    value,
    initial,
    onChange,
    allMinistries,
    disabled,
    preferredLangCode = "en",
}: Props) {
    const controlled = value != null;

    const buildDraft = (baseIn?: Partial<EventUpdate>): EventUpdate => {
        const nowIso = new Date().toISOString();
        const base = { ...(initial as any), ...(baseIn as any) } as Partial<EventUpdate>;
        const baseLocs = toRecordFromMap(base.localizations);

        const pref = preferredLangCode || "en";
        const locs = Object.keys(baseLocs).length
            ? baseLocs
            : { [pref]: { title: "", description: "", location_info: "" } };

        return {
            localizations: toMapFromRecord(locs),
            date: (base.date as string) ?? nowIso,
            end_date: (base.end_date as string | null) ?? null,
            recurring: (base.recurring ?? "never") as EventRecurrence,
            max_published: (base.max_published ?? 1),
            currently_publishing: (base.currently_publishing ?? true),
            hidden: (base.hidden ?? false),
            registration_allowed: (base.registration_allowed ?? true),
            rsvp_required: (base.rsvp_required ?? false),
            registration_opens: (base.registration_opens ?? null) as any,
            registration_deadline: (base.registration_deadline ?? null) as any,
            automatic_refund_deadline: (base.automatic_refund_deadline ?? null) as any,
            ministries: (base.ministries ?? []),
            members_only: (base.members_only ?? false),
            max_spots: (base.max_spots ?? null),
            price: (base.price ?? 0),
            member_price: (base.member_price ?? null),
            discount_codes: (base.discount_codes ?? []),
            min_age: (base.min_age ?? null),
            max_age: (base.max_age ?? null),
            gender: (base.gender ?? "all") as EventGenderOption,
            location_address: (base.location_address ?? null),
            image_id: (base.image_id ?? ""),
            payment_options: (base.payment_options ?? []),
        };
    };

    const [draft, setDraft] = useState<EventUpdate>(() => buildDraft(value));

    // guard so we don't fire onChange during parent syncs
    const syncingFromParent = useRef(false);

    useEffect(() => {
        if (!controlled) return;
        syncingFromParent.current = true;
        setDraft(buildDraft(value));
        // microtask to clear the flag after state is queued
        queueMicrotask(() => { syncingFromParent.current = false; });
    }, [controlled, value]);

    const updateDraft = (updater: EventUpdate | ((prev: EventUpdate) => EventUpdate)) => {
        setDraft((prev) => {
            const next = typeof updater === "function" ? (updater as any)(prev) : updater;
            if (controlled && !syncingFromParent.current) {
                onChange?.(next);
            } else if (!controlled) {
                onChange?.(next);
            }
            return next;
        });
    };

    const locRecord = toRecordFromMap(draft.localizations);
    const languageDisplayNames = useMemo(
        () => Object.keys(localizationNameToCode).sort((a, b) => a.localeCompare(b)),
        [],
    );
    const [activeLang, setActiveLang] = useState<string>(() => {
        const pref = preferredLangCode || "en";
        if (locRecord[pref]) return pref;
        const first = Object.keys(locRecord)[0] || pref;
        return first;
    });
    useEffect(() => {
        const pref = preferredLangCode || "en";
        if (!locRecord[activeLang]) {
            setActiveLang(locRecord[pref] ? pref : Object.keys(locRecord)[0] || "");
        }
    }, [preferredLangCode, draft.localizations, activeLang]);

    const setLocField = (lang: string, field: keyof EventLocalization, val: string) => {
        const nextRecs: Record<string, EventLocalization> = {
            ...locRecord,
            [lang]: { ...(locRecord[lang] || { title: "", description: "", location_info: "" }), [field]: val },
        };
        updateDraft({ ...draft, localizations: toMapFromRecord(nextRecs) });
    };
    const addLocaleByName = (displayName: string) => {
        const code = localizationNameToCode[displayName];
        if (!code) return;
        if (locRecord[code]) {
            setActiveLang(code);
            return;
        }
        const next = { ...locRecord, [code]: { title: "", description: "", location_info: "" } };
        updateDraft({ ...draft, localizations: toMapFromRecord(next) });
        setActiveLang(code);
    };
    const removeLocale = (code: string) => {
        const copy = { ...locRecord };
        delete copy[code];
        updateDraft({ ...draft, localizations: toMapFromRecord(copy) });
        const keys = Object.keys(copy);
        if (activeLang === code) setActiveLang(keys[0] || "");
    };

    // RSVP gate: when false, clear windows
    useEffect(() => {
        if (!draft.rsvp_required) {
            updateDraft({
                ...draft,
                registration_opens: null,
                registration_deadline: null,
                automatic_refund_deadline: null,
            });
        }
    }, [draft.rsvp_required]);

    const regOpensEnabled = !!draft.registration_opens;
    const regDeadlineEnabled = !!draft.registration_deadline;
    const refundDeadlineEnabled = !!draft.automatic_refund_deadline;

    // --- Calendar month control so popover opens to currently selected date, not "today"
    // Event date
    const [monthDateEvent, setMonthDateEvent] = useState<Date>(() => new Date(draft.date));
    useEffect(() => {
        setMonthDateEvent(new Date(draft.date));
    }, [draft.date]);

    const [monthDateEnd, setMonthDateEnd] = useState<Date>(() =>
        draft.end_date ? new Date(draft.end_date) : new Date(draft.date)
    );
    useEffect(() => {
        setMonthDateEnd(draft.end_date ? new Date(draft.end_date) : new Date(draft.date));
    }, [draft.end_date, draft.date]);

    // Opens
    const [monthDateOpens, setMonthDateOpens] = useState<Date>(() =>
        draft.registration_opens ? new Date(draft.registration_opens) : new Date(draft.date),
    );
    useEffect(() => {
        setMonthDateOpens(draft.registration_opens ? new Date(draft.registration_opens) : new Date(draft.date));
    }, [draft.registration_opens, draft.date]);

    // Deadline
    const [monthDateDeadline, setMonthDateDeadline] = useState<Date>(() =>
        draft.registration_deadline ? new Date(draft.registration_deadline) : new Date(draft.date),
    );
    useEffect(() => {
        setMonthDateDeadline(draft.registration_deadline ? new Date(draft.registration_deadline) : new Date(draft.date));
    }, [draft.registration_deadline, draft.date]);

    // Refund deadline
    const [monthDateRefund, setMonthDateRefund] = useState<Date>(() =>
        draft.automatic_refund_deadline ? new Date(draft.automatic_refund_deadline) : new Date(draft.date),
    );
    useEffect(() => {
        setMonthDateRefund(
            draft.automatic_refund_deadline ? new Date(draft.automatic_refund_deadline) : new Date(draft.date),
        );
    }, [draft.automatic_refund_deadline, draft.date]);

    // ---- Price input buffers (allow temporary blank text) ----
    const [priceText, setPriceText] = useState<string>(() =>
        draft.price != null ? String(draft.price) : ""
    );
    useEffect(() => {
        // sync buffer if draft.price changes externally
        setPriceText(draft.price != null ? String(draft.price) : "");
    }, [draft.price]);

    const [memberPriceText, setMemberPriceText] = useState<string>(() =>
        draft.member_price == null ? "" : String(draft.member_price)
    );
    useEffect(() => {
        setMemberPriceText(draft.member_price == null ? "" : String(draft.member_price));
    }, [draft.member_price]);

    function commitPriceFromText() {
        const n = Number(priceText);
        updateDraft({ ...draft, price: Number.isFinite(n) && n >= 0 ? n : 0 });
        // normalize buffer to committed number (avoids lingering invalid strings)
        setPriceText(String(Number.isFinite(n) && n >= 0 ? n : 0));
    }

    function commitMemberPriceFromText() {
        const txt = memberPriceText.trim();
        if (txt === "") {
            updateDraft({ ...draft, member_price: null });
            return; // buffer stays "", which is fine for UX
        }
        const n = Number(txt);
        updateDraft({ ...draft, member_price: Number.isFinite(n) && n >= 0 ? n : null });
        setMemberPriceText(Number.isFinite(n) && n >= 0 ? String(n) : "");
    }

    // Allow temporary blank while typing; commit on blur
    const [maxPublishedText, setMaxPublishedText] = useState<string>(() =>
        draft.max_published != null ? String(draft.max_published) : "1"
    );

    useEffect(() => {
        // sync buffer if draft changes externally (e.g., changing recurrence)
        setMaxPublishedText(draft.max_published != null ? String(draft.max_published) : "1");
    }, [draft.max_published]);

    function commitMaxPublishedFromText() {
        const n = Number(maxPublishedText);
        // floor and clamp; default back to 1 if empty/invalid
        const val = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
        updateDraft({ ...draft, max_published: val });
        setMaxPublishedText(String(val));
    }


    // Ministry data assembly
    const ministryNameById = useMemo<Record<string, string>>(
        () => Object.fromEntries(allMinistries.map((m) => [m.id, m.name])),
        [allMinistries],
    );
    const selectedMinistryNames = useMemo(() => {
        if (!draft.ministries?.length) return "";
        const names = draft.ministries.map((id) => ministryNameById[id]).filter(Boolean);
        return names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
    }, [draft.ministries, ministryNameById]);

    return (
        <div className="grid gap-8">
            {/* Localization inputs */}
            <section>
                <h3 className="text-base font-semibold">Localized Text</h3>
                <p className="text-sm text-muted-foreground">
                    Translations for title, description, and location info.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {/* Localization chip badges */}
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(locRecord).length === 0 && (
                            <Badge variant="destructive">No locales added</Badge>
                        )}
                        {Object.keys(locRecord).map((code) => (
                            <Badge
                                key={code}
                                variant={code === activeLang ? "default" : "secondary"}
                                className="cursor-pointer"
                                onClick={() => setActiveLang(code)}
                            >
                                {code}
                                <button
                                    type="button"
                                    className="ml-2 text-xs opacity-70 hover:opacity-100"
                                    onClick={(e) => { e.stopPropagation(); removeLocale(code); }}
                                    disabled={disabled}
                                    aria-label={`Remove ${code}`}
                                >
                                    ×
                                </button>
                            </Badge>
                        ))}
                    </div>

                    {/* Add Locale */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" disabled={disabled}>
                                Add locale
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-80" onWheel={(e) => e.stopPropagation()}>
                            <Command>
                                <CommandInput placeholder="Search languages…" />
                                <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                    <CommandEmpty>No languages found.</CommandEmpty>
                                    <CommandGroup>
                                        {languageDisplayNames.map((name) => (
                                            <CommandItem key={name} onSelect={() => addLocaleByName(name)}>
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {activeLang && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        Editing localization for <span className="font-medium">{codeToLanguageName(activeLang)}</span>
                    </p>
                )}

                {activeLang && (
                    <div className="mt-4 grid gap-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="max-w-sm">
                                <Label htmlFor="title">Title ({activeLang})</Label>
                                <Input
                                    id="title"
                                    disabled={disabled}
                                    value={locRecord[activeLang]?.title ?? ""}
                                    onChange={(e) => setLocField(activeLang, "title", e.target.value)}
                                />
                            </div>
                            <div className="max-w-sm">
                                <Label htmlFor="locationInfo">Location Info ({activeLang})</Label>
                                <Input
                                    id="locationInfo"
                                    disabled={disabled}
                                    value={locRecord[activeLang]?.location_info ?? ""}
                                    onChange={(e) => setLocField(activeLang, "location_info", e.target.value)}
                                    placeholder="e.g., Gymnasium / Room A; special parking info, etc."
                                />
                            </div>
                        </div>
                        <div className="max-w-2xl">
                            <Label htmlFor="description">Description ({activeLang})</Label>
                            <Textarea
                                id="description"
                                disabled={disabled}
                                value={locRecord[activeLang]?.description ?? ""}
                                onChange={(e) => setLocField(activeLang, "description", e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </section>

            <Separator />

            {/* Location Address and Image Selection */}
            <section className="grid md:grid-cols-2 gap-6">
                <div className="max-w-xl">
                    <h3 className="text-base font-semibold">Location Address</h3>
                    <p className="text-sm text-muted-foreground">
                        To get the best maps and wayfinding: open Google Maps, find your venue, then copy the venue
                        <span className="font-medium"> name</span> and <span className="font-medium">address</span> exactly and paste as
                        <span className="italic"> “Name, Address”</span>. Example:{" "}
                        <span className="italic">“Civic Auditorium, 123 Main St, Springfield, IL 62701”</span>.
                    </p>
                    <div className="mt-3 max-w-lg">
                        <Label htmlFor="locAddr">Location Address</Label>
                        <Input
                            id="locAddr"
                            disabled={disabled}
                            value={draft.location_address ?? ""}
                            onChange={(e) =>
                                updateDraft({ ...draft, location_address: e.target.value || null })
                            }
                            placeholder="Civic Auditorium, 123 Main St, Springfield, IL 62701"
                        />
                    </div>
                </div>

                <div className="max-w-xl">
                    <h3 className="text-base font-semibold">Event Image</h3>
                    <p className="text-sm text-muted-foreground">Shown in listings and details.</p>
                    <div className="mt-3">
                        <EventImageSelector
                            value={draft.image_id}
                            onChange={(id) => updateDraft({ ...draft, image_id: id })}
                        />
                    </div>
                </div>
            </section>

            <Separator />

            {/* Date and Recurrence Options */}
            <section>
                <h3 className="text-base font-semibold">Date &amp; Recurrence</h3>
                <p className="text-sm text-muted-foreground">
                    Weekly = every 7 days; Monthly = same day each month; Yearly = same date each year.
                </p>

                <div className="mt-3 grid md:grid-cols-3 gap-4 max-w-5xl">
                    <div className="md:col-span-2">
                        <Label>Event date</Label>
                        <div className="mt-2 flex flex-col gap-3 max-w-lg">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="justify-start">
                                        {dateLabel(draft.date)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                    <Calendar
                                        mode="single"
                                        month={monthDateEvent}
                                        onMonthChange={setMonthDateEvent}
                                        selected={new Date(draft.date)}
                                        onSelect={(d: Date | undefined) => {
                                            if (!d) return;
                                            const current = new Date(draft.date);
                                            const next = new Date(d);
                                            next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                                            updateDraft({ ...draft, date: next.toISOString() });
                                        }}
                                        disabled={disabled}
                                        initialFocus
                                    />
                                    <div className="mt-3 w-48">
                                        <Label htmlFor="eventTime">Time</Label>
                                        <Input
                                            id="eventTime"
                                            type="time"
                                            disabled={disabled}
                                            value={new Date(draft.date).toTimeString().slice(0, 5)}
                                            onChange={(e) => {
                                                const [hh, mm] = e.target.value.split(":").map((n) => parseInt(n, 10));
                                                const next = new Date(draft.date);
                                                next.setHours(hh || 0, mm || 0, 0, 0);
                                                updateDraft({ ...draft, date: next.toISOString() });
                                            }}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="endDateEnabled"
                                checked={!!draft.end_date}
                                onCheckedChange={(v) =>
                                    updateDraft({ ...draft, end_date: v ? (draft.end_date ?? new Date(draft.date).toISOString()) : null })
                                }
                                disabled={disabled}
                            />
                            <Label htmlFor="endDateEnabled">End date</Label>
                        </div>

                        <div className={`${!draft.end_date ? "opacity-50 pointer-events-none" : ""} mt-2 max-w-md`}>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="justify-start w-full">
                                        {dateLabel(draft.end_date)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                    <Calendar
                                        mode="single"
                                        month={monthDateEnd}
                                        onMonthChange={setMonthDateEnd}
                                        selected={draft.end_date ? new Date(draft.end_date) : undefined}
                                        onSelect={(d: Date | undefined) => {
                                            if (!d) return;
                                            const current = draft.end_date ? new Date(draft.end_date) : new Date(draft.date);
                                            const next = new Date(d);
                                            next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                                            updateDraft({ ...draft, end_date: next.toISOString() });
                                        }}
                                        disabled={disabled}
                                        initialFocus
                                    />
                                    <div className="mt-3 w-48">
                                        <Label htmlFor="endTime">Time</Label>
                                        <Input
                                            id="endTime"
                                            type="time"
                                            disabled={disabled}
                                            value={draft.end_date ? new Date(draft.end_date).toTimeString().slice(0, 5) : "17:00"}
                                            onChange={(e) => {
                                                const [hh, mm] = e.target.value.split(":").map((n) => parseInt(n, 10));
                                                const base = draft.end_date ? new Date(draft.end_date) : new Date(draft.date);
                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                updateDraft({ ...draft, end_date: base.toISOString() });
                                            }}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <p className="mt-1 text-xs text-muted-foreground">
                                End must be after start
                            </p>
                        </div>
                    </div>

                    <div className="max-w-xs">
                        <Label>Recurrence</Label>
                        <Select
                            value={draft.recurring}
                            onValueChange={(v) => {
                                const next: EventUpdate = { ...draft, recurring: v as EventRecurrence };
                                if (v === "never") next.max_published = 1;
                                updateDraft(next);
                            }}
                            disabled={disabled}
                        >
                            <SelectTrigger><SelectValue placeholder="Recurrence" /></SelectTrigger>
                            <SelectContent>
                                {recurrences.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r.charAt(0).toUpperCase() + r.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </section>

            <Separator />

            {/* Registration Options */}
            <section className="max-w-5xl">
                <h3 className="text-base font-semibold">Registration</h3>
                <p className="text-sm text-muted-foreground">
                    Registration windows and refund deadline propagate to instances using recurrence-aware offsets.
                </p>

                {/* RSVP required */}
                <div className="mt-3">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="rsvpRequired"
                            checked={!!draft.rsvp_required}
                            onCheckedChange={(v) => updateDraft({ ...draft, rsvp_required: !!v })}
                            disabled={disabled}
                        />
                        <Label htmlFor="rsvpRequired">RSVP required</Label>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        If off, windows/capacity/pricing are cleared &amp; disabled.
                    </p>
                </div>

                {/* toggles */}
                <div className="mt-4 grid md:grid-cols-3 gap-6">
                    <div className="max-w-sm">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="opensEnabled"
                                checked={regOpensEnabled}
                                onCheckedChange={(v) =>
                                    updateDraft({
                                        ...draft,
                                        registration_opens: v ? (draft.registration_opens ?? new Date().toISOString()) : null,
                                    })
                                }
                                disabled={disabled || !draft.rsvp_required}
                            />
                            <Label htmlFor="opensEnabled">Registration opens</Label>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            When signups first become available.
                        </p>
                    </div>

                    <div className="max-w-sm">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="deadlineEnabled"
                                checked={regDeadlineEnabled}
                                onCheckedChange={(v) =>
                                    updateDraft({
                                        ...draft,
                                        registration_deadline: v ? (draft.registration_deadline ?? new Date().toISOString()) : null,
                                    })
                                }
                                disabled={disabled || !draft.rsvp_required}
                            />
                        </div>
                        <Label htmlFor="deadlineEnabled">Registration deadline</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Last moment to register. Must be on/before the event date.
                        </p>
                    </div>

                    <div className="max-w-sm">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="refundDeadlineEnabled"
                                checked={refundDeadlineEnabled}
                                onCheckedChange={(v) =>
                                    updateDraft({
                                        ...draft,
                                        automatic_refund_deadline: v ? (draft.automatic_refund_deadline ?? new Date().toISOString()) : null,
                                    })
                                }
                                disabled={disabled || !draft.rsvp_required}
                            />
                            <Label htmlFor="refundDeadlineEnabled">Automatic refund deadline</Label>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Latest time a paid registration is automatically eligible for refund. Must be{" "}
                            <span className="font-medium">before</span> the event date, and on/after the opens/deadline windows.
                        </p>
                    </div>
                </div>

                {/* datetime pickers */}
                <div className="mt-3 grid md:grid-cols-3 gap-6">
                    {/* Opens at */}
                    <div className={`${!draft.rsvp_required || !regOpensEnabled ? "opacity-50 pointer-events-none" : ""} max-w-md`}>
                        <Label>Opens at</Label>
                        <div className="mt-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="justify-start w-full">
                                        {dateLabel(draft.registration_opens)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                    <Calendar
                                        mode="single"
                                        month={monthDateOpens}
                                        onMonthChange={setMonthDateOpens}
                                        selected={draft.registration_opens ? new Date(draft.registration_opens) : undefined}
                                        onSelect={(d: Date | undefined) => {
                                            if (!d) return;
                                            const current = draft.registration_opens ? new Date(draft.registration_opens) : new Date();
                                            const next = new Date(d);
                                            next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                                            updateDraft({ ...draft, registration_opens: next.toISOString() });
                                        }}
                                        disabled={disabled}
                                        initialFocus
                                    />
                                    <div className="mt-3 w-48">
                                        <Label htmlFor="regOpensTime">Time</Label>
                                        <Input
                                            id="regOpensTime"
                                            type="time"
                                            disabled={disabled}
                                            value={draft.registration_opens ? new Date(draft.registration_opens).toTimeString().slice(0, 5) : "09:00"}
                                            onChange={(e) => {
                                                const [hh, mm] = e.target.value.split(":").map((n) => parseInt(n, 10));
                                                const base = draft.registration_opens ? new Date(draft.registration_opens) : new Date();
                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                updateDraft({ ...draft, registration_opens: base.toISOString() });
                                            }}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Registration deadline */}
                    <div className={`${!draft.rsvp_required || !regDeadlineEnabled ? "opacity-50 pointer-events-none" : ""} max-w-md`}>
                        <Label>Registration deadline</Label>
                        <div className="mt-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="justify-start w-full">
                                        {dateLabel(draft.registration_deadline)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                    <Calendar
                                        mode="single"
                                        month={monthDateDeadline}
                                        onMonthChange={setMonthDateDeadline}
                                        selected={draft.registration_deadline ? new Date(draft.registration_deadline) : undefined}
                                        onSelect={(d: Date | undefined) => {
                                            if (!d) return;
                                            const current = draft.registration_deadline ? new Date(draft.registration_deadline) : new Date();
                                            const next = new Date(d);
                                            next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                                            updateDraft({ ...draft, registration_deadline: next.toISOString() });
                                        }}
                                        disabled={disabled}
                                        initialFocus
                                    />
                                    <div className="mt-3 w-48">
                                        <Label htmlFor="regDeadlineTime">Time</Label>
                                        <Input
                                            id="regDeadlineTime"
                                            type="time"
                                            disabled={disabled}
                                            value={draft.registration_deadline ? new Date(draft.registration_deadline).toTimeString().slice(0, 5) : "17:00"}
                                            onChange={(e) => {
                                                const [hh, mm] = e.target.value.split(":").map((n) => parseInt(n, 10));
                                                const base = draft.registration_deadline ? new Date(draft.registration_deadline) : new Date();
                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                updateDraft({ ...draft, registration_deadline: base.toISOString() });
                                            }}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Automatic refund deadline */}
                    <div className={`${!draft.rsvp_required || !refundDeadlineEnabled ? "opacity-50 pointer-events-none" : ""} max-w-md`}>
                        <Label>Automatic refund deadline</Label>
                        <div className="mt-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="justify-start w-full">
                                        {dateLabel(draft.automatic_refund_deadline)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                    <Calendar
                                        mode="single"
                                        month={monthDateRefund}
                                        onMonthChange={setMonthDateRefund}
                                        selected={draft.automatic_refund_deadline ? new Date(draft.automatic_refund_deadline) : undefined}
                                        onSelect={(d: Date | undefined) => {
                                            if (!d) return;
                                            const current = draft.automatic_refund_deadline
                                                ? new Date(draft.automatic_refund_deadline)
                                                : new Date();
                                            const next = new Date(d);
                                            next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                                            updateDraft({ ...draft, automatic_refund_deadline: next.toISOString() });
                                        }}
                                        disabled={disabled}
                                        initialFocus
                                    />
                                    <div className="mt-3 w-48">
                                        <Label htmlFor="refundDeadlineTime">Time</Label>
                                        <Input
                                            id="refundDeadlineTime"
                                            type="time"
                                            disabled={disabled}
                                            value={
                                                draft.automatic_refund_deadline
                                                    ? new Date(draft.automatic_refund_deadline).toTimeString().slice(0, 5)
                                                    : "17:00"
                                            }
                                            onChange={(e) => {
                                                const [hh, mm] = e.target.value.split(":").map((n) => parseInt(n, 10));
                                                const base = draft.automatic_refund_deadline
                                                    ? new Date(draft.automatic_refund_deadline)
                                                    : new Date();
                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                updateDraft({ ...draft, automatic_refund_deadline: base.toISOString() });
                                            }}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Used by the system to determine refund eligibility automatically after payment capture.
                        </p>
                    </div>
                </div>

                {/* Capacity / Pricing */}
                <div className="mt-4 max-w-xs">
                    <Label htmlFor="maxSpots">Max spots</Label>
                    <Input
                        id="maxSpots"
                        type="number"
                        min={0}
                        value={draft.max_spots ?? ""}
                        onChange={(e) =>
                            updateDraft({ ...draft, max_spots: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        disabled={disabled || !draft.rsvp_required}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Leave blank for unlimited capacity.</p>
                </div>

                <div className="mt-4 grid md:grid-cols-2 gap-6">
                    <div className="max-w-xs">
                        <Label htmlFor="price">Price</Label>
                        <Input
                            id="price"
                            inputMode="decimal"
                            value={priceText}
                            onChange={(e) => setPriceText(e.target.value)}
                            onBlur={commitPriceFromText}
                            disabled={disabled || !draft.rsvp_required}
                            placeholder="0.00"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            If price &gt; 0, pick at least one payment option.
                        </p>
                    </div>
                    <div className="max-w-xs">
                        <Label htmlFor="memberPrice">Members price</Label>
                        <Input
                            id="memberPrice"
                            inputMode="decimal"
                            value={memberPriceText}
                            onChange={(e) => setMemberPriceText(e.target.value)}
                            onBlur={commitMemberPriceFromText}
                            disabled={disabled || !draft.rsvp_required}
                            placeholder="(optional)"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <Label>Payment options</Label>
                    <div className={`flex flex-wrap gap-4 mt-2 ${!draft.rsvp_required ? "opacity-50 pointer-events-none" : ""}`}>
                        {paymentChoices.map((opt) => {
                            const checked = draft.payment_options?.includes(opt);
                            return (
                                <label key={opt} className="flex items-center gap-2 w-32">
                                    <Checkbox
                                        checked={!!checked}
                                        onCheckedChange={(v) => {
                                            const set = new Set(draft.payment_options ?? []);
                                            if (v) set.add(opt);
                                            else set.delete(opt);
                                            updateDraft({ ...draft, payment_options: Array.from(set) });
                                        }}
                                        disabled={disabled || !draft.rsvp_required}
                                    />
                                    <span className="capitalize">{opt}</span>
                                </label>
                            );
                        })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        “Door” = pay at the door; “PayPal” = online checkout. You can enable both.
                    </p>
                </div>

                {/* Refund policy removed */}
            </section>

            <Separator />

            {/* Event allowed person criteria */}
            <section className="max-w-3xl">
                <h3 className="text-base font-semibold">Who is allowed to attend</h3>
                <p className="text-sm text-muted-foreground">Restrict by membership, gender, and age.</p>

                <div className="mt-3 flex items-center gap-2">
                    <Checkbox
                        id="membersOnly"
                        checked={!!draft.members_only}
                        onCheckedChange={(v) => updateDraft({ ...draft, members_only: !!v })}
                        disabled={disabled}
                    />
                    <Label htmlFor="membersOnly">Members only</Label>
                </div>

                <div className="mt-4 max-w-xs">
                    <Label>Gender</Label>
                    <Select
                        value={draft.gender}
                        onValueChange={(v) => updateDraft({ ...draft, gender: v as EventGenderOption })}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-56"><SelectValue placeholder="Gender" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Allowed</SelectItem>
                            <SelectItem value="male">Men only</SelectItem>
                            <SelectItem value="female">Women only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-6 max-w-md">
                    <div className="w-32">
                        <Label htmlFor="minAge">Min age</Label>
                        <Input
                            id="minAge"
                            type="number"
                            min={0}
                            value={draft.min_age ?? ""}
                            onChange={(e) =>
                                updateDraft({ ...draft, min_age: e.target.value === "" ? null : Number(e.target.value) })
                            }
                            disabled={disabled}
                        />
                    </div>
                    <div className="w-32">
                        <Label htmlFor="maxAge">Max age</Label>
                        <Input
                            id="maxAge"
                            type="number"
                            min={0}
                            value={draft.max_age ?? ""}
                            onChange={(e) =>
                                updateDraft({ ...draft, max_age: e.target.value === "" ? null : Number(e.target.value) })
                            }
                            disabled={disabled}
                        />
                    </div>
                </div>
            </section>

            <Separator />

            {/* Publishing Controls */}
            <section className="max-w-5xl">
                <h3 className="text-base font-semibold">Publishing Settings</h3>

                {/* Ministries */}
                <div className="mt-3 max-w-md">
                    <div className="flex flex-col items-start gap-2">
                        <Label htmlFor="ministries-trigger">Ministries</Label>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="ministries-trigger"
                                    type="button"
                                    variant="outline"
                                    className="justify-between w-[300px]"
                                    disabled={disabled}
                                >
                                    {draft.ministries?.length ? (
                                        <span className="truncate">{selectedMinistryNames}</span>
                                    ) : (
                                        <span>Choose ministries</span>
                                    )}
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="p-0 w-[300px]" align="start" onWheel={(e) => e.stopPropagation()}>
                                <Command>
                                    <CommandInput placeholder="Search ministries…" />
                                    <CommandEmpty>No results.</CommandEmpty>
                                    <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                        <CommandGroup>
                                            {allMinistries.map((m) => {
                                                const checked = draft.ministries?.includes(m.id);
                                                return (
                                                    <CommandItem
                                                        key={m.id}
                                                        onSelect={() => {
                                                            const next = new Set(draft.ministries ?? []);
                                                            if (checked) next.delete(m.id);
                                                            else next.add(m.id);
                                                            updateDraft({ ...draft, ministries: Array.from(next) });
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox checked={!!checked} />
                                                            <span>{m.name}</span>
                                                        </div>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        <p className="text-xs text-muted-foreground">Tags used for categorization and discovery.</p>
                    </div>
                </div>

                {/* Currently Published | Max Published */}
                <div className="mt-4 grid md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="publishing"
                            checked={!!draft.currently_publishing}
                            onCheckedChange={(v) => updateDraft({ ...draft, currently_publishing: !!v })}
                            disabled={disabled}
                        />
                        <div className="flex flex-col">
                            <Label htmlFor="publishing">Currently publishing events</Label>
                            <span className="text-xs text-muted-foreground">
                                If unchecked, no new instances will publish; existing ones stay live.
                            </span>
                        </div>
                    </div>

                    <div className="max-w-xs">
                        <Label htmlFor="maxPublished">Max published</Label>
                        <Input
                            id="maxPublished"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={maxPublishedText}
                            onChange={(e) => setMaxPublishedText(e.target.value)}
                            onBlur={commitMaxPublishedFromText}
                            disabled={disabled || draft.recurring === "never"}
                            placeholder="1"
                        />
                    </div>
                </div>

                {/* Registration Allowed | Hidden */}
                <div className="mt-4 grid md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="regAllowed"
                            checked={!!draft.registration_allowed}
                            onCheckedChange={(v) => updateDraft({ ...draft, registration_allowed: !!v })}
                            disabled={disabled}
                        />
                        <div className="flex flex-col">
                            <Label htmlFor="regAllowed">Registration allowed</Label>
                            <span className="text-xs text-muted-foreground">
                                Turn this off to temporarily stop new signups without unpublishing.
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="hidden"
                            checked={!!draft.hidden}
                            onCheckedChange={(v) => updateDraft({ ...draft, hidden: !!v })}
                            disabled={disabled}
                        />
                        <div className="flex flex-col">
                            <Label htmlFor="hidden">Hidden</Label>
                            <span className="text-xs text-muted-foreground">
                                Hidden events are not listed publicly but remain accessible by direct link.
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
