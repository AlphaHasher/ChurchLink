import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/shared/components/ui/Dialog";
import { Switch } from "@/shared/components/ui/switch";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Badge } from "@/shared/components/ui/badge";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/shared/components/ui/select";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/shared/components/ui/popover";
import {
    Command,
    CommandInput,
    CommandEmpty,
    CommandList,
    CommandGroup,
    CommandItem,
} from "@/shared/components/ui/command";
import { Calendar } from "@/shared/components/ui/calendar";
import { Pencil } from "lucide-react";

import EventImageSelector from "../EventManagement/EventImageSelector";
import { localizationNameToCode } from "@/shared/dictionaries/LocalizationDicts";

import type {
    AdminEventInstance,
    AdminEventInstanceOverrides,
    EventLocalization,
    EventPaymentOption,
    EventGenderOption,
} from "@/shared/types/Event";

import {
    OverridesGroupsOn,
    updateEventInstanceOverrides,
} from "@/helpers/EventManagementHelper";

import { localeEnUSToISOInAdminTz } from "@/helpers/TimeFormatter";


function dateLabel(iso?: string | null) {
    if (!iso) return "Pick date";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Pick date";
    return d.toLocaleString();
}

export type Props = {
    instance: AdminEventInstance;
    onSaved?: () => void;
};

export default function EditEventInstanceDialog({ instance, onSaved }: Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [draft, setDraft] = useState<AdminEventInstanceOverrides>({});

    // Group switches (1..7) derived from `instance.overrides_tracker`
    const [groupsOn, setGroupsOn] = useState<OverridesGroupsOn>({
        1: false,
        2: false,
        3: false,
        4: false,
        5: false,
        6: false,
        7: false,
    });


    const localizationsMap = draft.localizations;

    const locKeys = useMemo<string[]>(
        () =>
            localizationsMap instanceof Map ? Array.from(localizationsMap.keys()) : [],
        [localizationsMap]
    );

    const [activeLang, setActiveLang] = useState<string>("");

    const setLocField = (
        lang: string,
        field: keyof Pick<
            EventLocalization,
            "title" | "description" | "location_info"
        >,
        val: string
    ) => {
        if (!(draft.localizations instanceof Map)) return;
        const next = new Map(draft.localizations);
        const prev = next.get(lang) ?? {
            title: "",
            description: "",
            location_info: "",
        };
        next.set(lang, { ...prev, [field]: val });
        setDraft((d) => ({ ...d, localizations: next }));
    };

    const addLocaleByName = (displayName: string) => {
        const code = localizationNameToCode[displayName];
        if (!code) return;
        if (!(draft.localizations instanceof Map)) {
            const next = new Map<string, EventLocalization>();
            next.set(code, { title: "", description: "", location_info: "" });
            setDraft((d) => ({ ...d, localizations: next }));
            setActiveLang(code);
            return;
        }
        if (draft.localizations.has(code)) {
            setActiveLang(code);
            return;
        }
        const next = new Map(draft.localizations);
        next.set(code, { title: "", description: "", location_info: "" });
        setDraft((d) => ({ ...d, localizations: next }));
        setActiveLang(code);
    };

    const removeLocale = (code: string) => {
        if (!(draft.localizations instanceof Map)) return;
        const next = new Map(draft.localizations);
        next.delete(code);
        setDraft((d) => ({ ...d, localizations: next }));
        if (activeLang === code) {
            const [first] = Array.from(next.keys());
            setActiveLang(first || "");
        }
    };

    /** ---------- Month control so calendars open on the selected date ---------- */
    const [monthDateEvent, setMonthDateEvent] = useState<Date | undefined>(
        undefined
    );
    const [monthDateEnd, setMonthDateEnd] = useState<Date | undefined>(undefined);
    const [monthDateOpens, setMonthDateOpens] = useState<Date | undefined>(
        undefined
    );
    const [monthDateDeadline, setMonthDateDeadline] = useState<
        Date | undefined
    >(undefined);
    const [monthDateRefund, setMonthDateRefund] = useState<Date | undefined>(
        undefined
    );


    const seedFromInstance = () => {
        // Normalize localizations from instance: accept Map or plain object
        const seededLocs = (() => {
            const src: any = (instance as any).localizations;
            if (!src) return undefined;

            if (src instanceof Map) {
                return new Map<string, EventLocalization>(
                    Array.from(src.entries()).map(([k, v]) => [
                        k,
                        {
                            title: v?.title ?? "",
                            description: v?.description ?? "",
                            location_info: v?.location_info ?? "",
                        },
                    ])
                );
            }

            if (typeof src === "object") {
                return new Map<string, EventLocalization>(
                    Object.entries(src).map(([k, v]: any) => [
                        k,
                        {
                            title: v?.title ?? "",
                            description: v?.description ?? "",
                            location_info: v?.location_info ?? "",
                        },
                    ])
                );
            }

            return undefined;
        })();

        // Hydrate draft from instance
        setDraft({
            localizations: seededLocs,
            location_address: instance.location_address ?? null,
            image_id: instance.image_id ?? null,
            date: localeEnUSToISOInAdminTz(instance.date) ?? instance.target_date ?? null,
            end_date: (instance as any).end_date ? localeEnUSToISOInAdminTz((instance as any).end_date) : null,
            hidden: instance.hidden ?? null,
            registration_allowed: instance.registration_allowed ?? null,
            registration_opens: localeEnUSToISOInAdminTz(instance.registration_opens) ?? null,
            registration_deadline: localeEnUSToISOInAdminTz(instance.registration_deadline) ?? null,
            automatic_refund_deadline: localeEnUSToISOInAdminTz(instance.automatic_refund_deadline) ?? null,
            members_only: instance.members_only ?? null,
            rsvp_required: instance.rsvp_required ?? null,
            max_spots: instance.max_spots ?? null,
            price: instance.price ?? null,
            member_price: instance.member_price ?? null,
            min_age: instance.min_age ?? null,
            max_age: instance.max_age ?? null,
            gender: instance.gender ?? null,
            payment_options: instance.payment_options ?? null,
        });

        // Set initial override tracker state
        const tracker = instance.overrides_tracker || [];
        setGroupsOn({
            1: !!tracker[0],
            2: !!tracker[1],
            3: !!tracker[2],
            4: !!tracker[3],
            5: !!tracker[4],
            6: !!tracker[5],
            7: !!tracker[6],
        });

        // Pick initial active language from hydrated map, else the instance default
        const firstLang =
            (seededLocs && Array.from(seededLocs.keys())[0]) ||
            (instance.default_localization || "en");
        setActiveLang(firstLang);

        // Initialize calendar months so pickers open near current values
        setMonthDateEvent(
            (instance as any).date
                ? new Date((instance as any).date)
                : instance.target_date
                    ? new Date(instance.target_date)
                    : undefined
        );
        setMonthDateOpens(
            instance.registration_opens
                ? new Date(instance.registration_opens)
                : (instance as any).date
                    ? new Date((instance as any).date)
                    : instance.target_date
                        ? new Date(instance.target_date)
                        : undefined
        );
        setMonthDateDeadline(
            instance.registration_deadline
                ? new Date(instance.registration_deadline)
                : (instance as any).date
                    ? new Date((instance as any).date)
                    : instance.target_date
                        ? new Date(instance.target_date)
                        : undefined
        );
        setMonthDateRefund(
            (instance as any).automatic_refund_deadline
                ? new Date((instance as any).automatic_refund_deadline)
                : (instance as any).date
                    ? new Date((instance as any).date)
                    : instance.target_date
                        ? new Date(instance.target_date)
                        : undefined
        );
        setMonthDateEnd(
            (instance as any).end_date
                ? new Date((instance as any).end_date)
                : (instance as any).date
                    ? new Date((instance as any).date)
                    : instance.target_date
                        ? new Date(instance.target_date)
                        : undefined
        );
    };

    // Price buffers for friendlier typing
    const [priceText, setPriceText] = useState<string>(() =>
        draft.price != null ? String(draft.price) : "0"
    );
    useEffect(() => {
        setPriceText(draft.price != null ? String(draft.price) : "0");
    }, [draft.price]);

    const [memberPriceText, setMemberPriceText] = useState<string>(() =>
        draft.member_price == null ? "" : String(draft.member_price)
    );
    useEffect(() => {
        setMemberPriceText(draft.member_price == null ? "" : String(draft.member_price));
    }, [draft.member_price]);

    function commitPriceFromText() {
        const n = Number(priceText);
        const val = Number.isFinite(n) && n >= 0 ? n : 0;
        updateDraft("price", val);
        setPriceText(String(val));
    }

    function commitMemberPriceFromText() {
        const t = memberPriceText.trim();
        if (t === "") {
            updateDraft("member_price", null);
            return;
        }
        const n = Number(t);
        if (Number.isFinite(n) && n >= 0) {
            updateDraft("member_price", n);
            setMemberPriceText(String(n));
        } else {
            // keep as blank if invalid
            setMemberPriceText("");
            updateDraft("member_price", null);
        }
    }

    useEffect(() => {
        if (!open) return;
        seedFromInstance();
    }, [open, instance]);

    const toggleGroup = (n: number, on: boolean) =>
        setGroupsOn((g) => ({ ...g, [n]: on }));

    const disabledClass = (on: boolean) => (on ? "" : "opacity-50 pointer-events-none");

    const updateDraft = <K extends keyof AdminEventInstanceOverrides>(
        key: K,
        value: AdminEventInstanceOverrides[K]
    ) => setDraft((d) => ({ ...d, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await updateEventInstanceOverrides(
                instance.event_id,
                instance.series_index,
                draft,
                groupsOn
            );
            if (!res?.success) {
                console.error(res?.msg || "Failed to update overrides");
                alert(res?.msg || "Failed to update event instance. Please try again.");
                setSaving(false);
                return;
            }
            setOpen(false);
            setSaving(false);
            onSaved?.();
        } catch (e) {
            console.error(e);
            alert("Unexpected error while saving the instance. Please try again.");
            setSaving(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                    seedFromInstance();
                    setOpen(true);
                }}
                title="Edit instance"
            >
                <Pencil className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(v) => (!saving ? setOpen(v) : null)}>
                <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Event Instance</DialogTitle>
                        <DialogDescription>
                            Toggle a group to override the base event for this specific occurrence. Only enabled groups are sent.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-8">
                        {/* GROUP 1: Localizations (title/description/location_info) */}
                        <section className="space-y-3 border rounded-md p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold">Localized Text</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Translations for title, description, and location info.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Override</span>
                                    <Switch
                                        checked={!!groupsOn[1]}
                                        onCheckedChange={(v) => toggleGroup(1, !!v)}
                                    />
                                </div>
                            </div>

                            <div className={disabledClass(!!groupsOn[1])}>
                                {/* Active locale chips */}
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <div className="flex flex-wrap gap-2">
                                        {locKeys.length === 0 && (
                                            <Badge variant="destructive">No locales added</Badge>
                                        )}
                                        {locKeys.map((code) => (
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeLocale(code);
                                                    }}
                                                    aria-label={`Remove ${code}`}
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>

                                    {/* Add locale popover */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button type="button" variant="outline" size="sm">
                                                Add locale
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="p-0 w-80"
                                            onWheel={(e) => e.stopPropagation()}
                                        >
                                            <Command>
                                                <CommandInput placeholder="Search languages…" />
                                                <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                                    <CommandEmpty>No languages found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {Object.keys(localizationNameToCode)
                                                            .sort((a, b) => a.localeCompare(b))
                                                            .map((name) => (
                                                                <CommandItem
                                                                    key={name}
                                                                    onSelect={() => addLocaleByName(name)}
                                                                >
                                                                    {name}
                                                                </CommandItem>
                                                            ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {activeLang && draft.localizations instanceof Map && (
                                    <div className="mt-4 grid gap-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="max-w-sm">
                                                <Label htmlFor="title">Title ({activeLang})</Label>
                                                <Input
                                                    id="title"
                                                    value={
                                                        draft.localizations.get(activeLang)?.title ?? ""
                                                    }
                                                    onChange={(e) =>
                                                        setLocField(activeLang, "title", e.target.value)
                                                    }
                                                />
                                            </div>
                                            <div className="max-w-sm">
                                                <Label htmlFor="locationInfo">
                                                    Location Info ({activeLang})
                                                </Label>
                                                <Input
                                                    id="locationInfo"
                                                    value={
                                                        draft.localizations.get(activeLang)?.location_info ??
                                                        ""
                                                    }
                                                    onChange={(e) =>
                                                        setLocField(
                                                            activeLang,
                                                            "location_info",
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="max-w-2xl">
                                            <Label htmlFor="description">
                                                Description ({activeLang})
                                            </Label>
                                            <Input
                                                id="description"
                                                value={
                                                    draft.localizations.get(activeLang)?.description ?? ""
                                                }
                                                onChange={(e) =>
                                                    setLocField(activeLang, "description", e.target.value)
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* GROUP 2: Location */}
                        <section className="space-y-3 border rounded-md p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold">Location</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Use <span className="font-medium">Location Address</span> as{" "}
                                        <i>Name, Address</i> (copy exact venue name and address from
                                        Google Maps).
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Override</span>
                                    <Switch
                                        checked={!!groupsOn[2]}
                                        onCheckedChange={(v) => toggleGroup(2, !!v)}
                                        aria-label="Override location for this instance"
                                    />
                                </div>
                            </div>

                            <div className={disabledClass(!!groupsOn[2])}>
                                <Label htmlFor="locAddr">Location Address</Label>
                                <Input
                                    id="locAddr"
                                    value={draft.location_address ?? ""}
                                    onChange={(e) =>
                                        updateDraft("location_address", e.target.value || null)
                                    }
                                    placeholder="Civic Auditorium, 123 Main St, Springfield, IL 62701"
                                />
                            </div>
                        </section>

                        {/* GROUP 3: Image */}
                        <section className="space-y-3 border rounded-md p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold">Image</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Override</span>
                                    <Switch
                                        checked={!!groupsOn[3]}
                                        onCheckedChange={(v) => toggleGroup(3, !!v)}
                                        aria-label="Override image for this instance"
                                    />
                                </div>
                            </div>

                            <div className={disabledClass(!!groupsOn[3])}>
                                <EventImageSelector
                                    value={draft.image_id || ""}
                                    onChange={(id) => updateDraft("image_id", id || null)}
                                />
                            </div>
                        </section>

                        {/* GROUP 4: Date & Time */}
                        <section className="space-y-3 border rounded-md p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold">Date &amp; Time</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Override</span>
                                    <Switch
                                        checked={!!groupsOn[4]}
                                        onCheckedChange={(v) => toggleGroup(4, !!v)}
                                    />
                                </div>
                            </div>

                            <div className={disabledClass(!!groupsOn[4])}>
                                <div className="grid md:grid-cols-3 gap-4 max-w-4xl">
                                    <div className="md:col-span-2">
                                        <Label>Event date</Label>
                                        <div className="mt-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="justify-start">
                                                        {dateLabel(draft.date as string)}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-3" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        month={monthDateEvent}
                                                        onMonthChange={setMonthDateEvent}
                                                        selected={
                                                            draft.date ? new Date(draft.date) : undefined
                                                        }
                                                        onSelect={(d: Date | undefined) => {
                                                            if (!d) return;
                                                            const current = draft.date
                                                                ? new Date(draft.date)
                                                                : new Date();
                                                            const next = new Date(d);
                                                            next.setHours(
                                                                current.getHours(),
                                                                current.getMinutes(),
                                                                0,
                                                                0
                                                            );
                                                            updateDraft("date", next.toISOString());
                                                        }}
                                                        initialFocus
                                                    />
                                                    <div className="mt-3 w-48">
                                                        <Label htmlFor="eventTime">Time</Label>
                                                        <Input
                                                            id="eventTime"
                                                            type="time"
                                                            value={
                                                                draft.date
                                                                    ? new Date(draft.date)
                                                                        .toTimeString()
                                                                        .slice(0, 5)
                                                                    : "09:00"
                                                            }
                                                            onChange={(e) => {
                                                                const [hh, mm] = e.target.value
                                                                    .split(":")
                                                                    .map((n) => parseInt(n, 10));
                                                                const base = draft.date
                                                                    ? new Date(draft.date)
                                                                    : new Date();
                                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                                updateDraft("date", base.toISOString());
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
                                                checked={draft.end_date != null}
                                                onCheckedChange={(v) =>
                                                    updateDraft("end_date", v ? (draft.end_date ?? draft.date ?? new Date().toISOString()) : null)
                                                }
                                            />
                                            <Label htmlFor="endDateEnabled">End date</Label>
                                        </div>

                                        <div className={`${draft.end_date == null ? "opacity-50 pointer-events-none" : ""} mt-2`}>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="justify-start">
                                                        {dateLabel(draft.end_date as string)}
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
                                                            const current = draft.end_date
                                                                ? new Date(draft.end_date)
                                                                : (draft.date ? new Date(draft.date) : new Date());
                                                            const next = new Date(d);
                                                            next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                                                            updateDraft("end_date", next.toISOString());
                                                        }}
                                                        initialFocus
                                                    />
                                                    <div className="mt-3 w-48">
                                                        <Label htmlFor="endTime">Time</Label>
                                                        <Input
                                                            id="endTime"
                                                            type="time"
                                                            value={
                                                                draft.end_date
                                                                    ? new Date(draft.end_date).toTimeString().slice(0, 5)
                                                                    : "17:00"
                                                            }
                                                            onChange={(e) => {
                                                                const [hh, mm] = e.target.value.split(":").map((n) => parseInt(n, 10));
                                                                const base = draft.end_date
                                                                    ? new Date(draft.end_date)
                                                                    : (draft.date ? new Date(draft.date) : new Date());
                                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                                updateDraft("end_date", base.toISOString());
                                                            }}
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Must be after the start date/time.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* GROUP 5: Registration & Pricing (now includes Automatic refund deadline) */}
                        <section className="space-y-3 border rounded-md p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold">
                                    RSVP / Registration / Pricing
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Override</span>
                                    <Switch
                                        checked={!!groupsOn[5]}
                                        onCheckedChange={(v) => toggleGroup(5, !!v)}
                                    />
                                </div>
                            </div>

                            <div className={disabledClass(!!groupsOn[5])}>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="rsvpRequired"
                                        checked={!!draft.rsvp_required}
                                        onCheckedChange={(v) =>
                                            updateDraft("rsvp_required", !!v)
                                        }
                                    />
                                    <Label htmlFor="rsvpRequired">RSVP required</Label>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    If off, windows/capacity/pricing are disabled.
                                </p>

                                {/* Window toggles */}
                                <div className="mt-4 grid md:grid-cols-3 gap-6">
                                    <div className="max-w-sm">
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                id="opensEnabled"
                                                checked={!!draft.registration_opens}
                                                onCheckedChange={(v) =>
                                                    updateDraft(
                                                        "registration_opens",
                                                        v
                                                            ? draft.registration_opens ??
                                                            new Date().toISOString()
                                                            : null
                                                    )
                                                }
                                                disabled={!draft.rsvp_required}
                                            />
                                            <Label htmlFor="opensEnabled">Registration opens</Label>
                                        </div>
                                    </div>

                                    <div className="max-w-sm">
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                id="deadlineEnabled"
                                                checked={!!draft.registration_deadline}
                                                onCheckedChange={(v) =>
                                                    updateDraft(
                                                        "registration_deadline",
                                                        v
                                                            ? draft.registration_deadline ??
                                                            new Date().toISOString()
                                                            : null
                                                    )
                                                }
                                                disabled={!draft.rsvp_required}
                                            />
                                            <Label htmlFor="deadlineEnabled">
                                                Registration deadline
                                            </Label>
                                        </div>
                                    </div>

                                    <div className="max-w-sm">
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                id="refundDeadlineEnabled"
                                                checked={!!draft.automatic_refund_deadline}
                                                onCheckedChange={(v) =>
                                                    updateDraft(
                                                        "automatic_refund_deadline",
                                                        v
                                                            ? draft.automatic_refund_deadline ??
                                                            new Date().toISOString()
                                                            : null
                                                    )
                                                }
                                                disabled={!draft.rsvp_required}
                                            />
                                            <Label htmlFor="refundDeadlineEnabled">
                                                Automatic refund deadline
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                {/* Window pickers */}
                                <div className="mt-3 grid md:grid-cols-3 gap-6">
                                    {/* Opens at */}
                                    <div
                                        className={`${!draft.rsvp_required || !draft.registration_opens
                                            ? "opacity-50 pointer-events-none"
                                            : ""
                                            } max-w-md`}
                                    >
                                        <Label>Opens at</Label>
                                        <div className="mt-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="justify-start w-full"
                                                    >
                                                        {dateLabel(draft.registration_opens as string)}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-3" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        month={monthDateOpens}
                                                        onMonthChange={setMonthDateOpens}
                                                        selected={
                                                            draft.registration_opens
                                                                ? new Date(draft.registration_opens)
                                                                : undefined
                                                        }
                                                        onSelect={(d: Date | undefined) => {
                                                            if (!d) return;
                                                            const current = draft.registration_opens
                                                                ? new Date(draft.registration_opens)
                                                                : new Date();
                                                            const next = new Date(d);
                                                            next.setHours(
                                                                current.getHours(),
                                                                current.getMinutes(),
                                                                0,
                                                                0
                                                            );
                                                            updateDraft(
                                                                "registration_opens",
                                                                next.toISOString()
                                                            );
                                                        }}
                                                        initialFocus
                                                    />
                                                    <div className="mt-3 w-48">
                                                        <Label htmlFor="regOpensTime">Time</Label>
                                                        <Input
                                                            id="regOpensTime"
                                                            type="time"
                                                            value={
                                                                draft.registration_opens
                                                                    ? new Date(draft.registration_opens)
                                                                        .toTimeString()
                                                                        .slice(0, 5)
                                                                    : "09:00"
                                                            }
                                                            onChange={(e) => {
                                                                const [hh, mm] = e.target.value
                                                                    .split(":")
                                                                    .map((n) => parseInt(n, 10));
                                                                const base = draft.registration_opens
                                                                    ? new Date(draft.registration_opens)
                                                                    : new Date();
                                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                                updateDraft(
                                                                    "registration_opens",
                                                                    base.toISOString()
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>

                                    {/* Registration deadline */}
                                    <div
                                        className={`${!draft.rsvp_required || !draft.registration_deadline
                                            ? "opacity-50 pointer-events-none"
                                            : ""
                                            } max-w-md`}
                                    >
                                        <Label>Deadline</Label>
                                        <div className="mt-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="justify-start w-full"
                                                    >
                                                        {dateLabel(draft.registration_deadline as string)}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-3" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        month={monthDateDeadline}
                                                        onMonthChange={setMonthDateDeadline}
                                                        selected={
                                                            draft.registration_deadline
                                                                ? new Date(draft.registration_deadline)
                                                                : undefined
                                                        }
                                                        onSelect={(d: Date | undefined) => {
                                                            if (!d) return;
                                                            const current = draft.registration_deadline
                                                                ? new Date(draft.registration_deadline)
                                                                : new Date();
                                                            const next = new Date(d);
                                                            next.setHours(
                                                                current.getHours(),
                                                                current.getMinutes(),
                                                                0,
                                                                0
                                                            );
                                                            updateDraft(
                                                                "registration_deadline",
                                                                next.toISOString()
                                                            );
                                                        }}
                                                        initialFocus
                                                    />
                                                    <div className="mt-3 w-48">
                                                        <Label htmlFor="regDeadlineTime">Time</Label>
                                                        <Input
                                                            id="regDeadlineTime"
                                                            type="time"
                                                            value={
                                                                draft.registration_deadline
                                                                    ? new Date(draft.registration_deadline)
                                                                        .toTimeString()
                                                                        .slice(0, 5)
                                                                    : "17:00"
                                                            }
                                                            onChange={(e) => {
                                                                const [hh, mm] = e.target.value
                                                                    .split(":")
                                                                    .map((n) => parseInt(n, 10));
                                                                const base = draft.registration_deadline
                                                                    ? new Date(draft.registration_deadline)
                                                                    : new Date();
                                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                                updateDraft(
                                                                    "registration_deadline",
                                                                    base.toISOString()
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>

                                    {/* Automatic refund deadline */}
                                    <div
                                        className={`${!draft.rsvp_required || !draft.automatic_refund_deadline
                                            ? "opacity-50 pointer-events-none"
                                            : ""
                                            } max-w-md`}
                                    >
                                        <Label>Automatic refund deadline</Label>
                                        <div className="mt-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="justify-start w-full"
                                                    >
                                                        {dateLabel(
                                                            draft.automatic_refund_deadline as string
                                                        )}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-3" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        month={monthDateRefund}
                                                        onMonthChange={setMonthDateRefund}
                                                        selected={
                                                            draft.automatic_refund_deadline
                                                                ? new Date(draft.automatic_refund_deadline)
                                                                : undefined
                                                        }
                                                        onSelect={(d: Date | undefined) => {
                                                            if (!d) return;
                                                            const current = draft.automatic_refund_deadline
                                                                ? new Date(draft.automatic_refund_deadline)
                                                                : new Date();
                                                            const next = new Date(d);
                                                            next.setHours(
                                                                current.getHours(),
                                                                current.getMinutes(),
                                                                0,
                                                                0
                                                            );
                                                            updateDraft(
                                                                "automatic_refund_deadline",
                                                                next.toISOString()
                                                            );
                                                        }}
                                                        initialFocus
                                                    />
                                                    <div className="mt-3 w-48">
                                                        <Label htmlFor="refundDeadlineTime">Time</Label>
                                                        <Input
                                                            id="refundDeadlineTime"
                                                            type="time"
                                                            value={
                                                                draft.automatic_refund_deadline
                                                                    ? new Date(draft.automatic_refund_deadline)
                                                                        .toTimeString()
                                                                        .slice(0, 5)
                                                                    : "17:00"
                                                            }
                                                            onChange={(e) => {
                                                                const [hh, mm] = e.target.value
                                                                    .split(":")
                                                                    .map((n) => parseInt(n, 10));
                                                                const base = draft.automatic_refund_deadline
                                                                    ? new Date(draft.automatic_refund_deadline)
                                                                    : new Date();
                                                                base.setHours(hh || 0, mm || 0, 0, 0);
                                                                updateDraft(
                                                                    "automatic_refund_deadline",
                                                                    base.toISOString()
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Must be before the event date and not earlier than
                                            registration opens/deadline.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid md:grid-cols-2 gap-6 max-w-3xl">
                                    <div className="max-w-xs">
                                        <Label htmlFor="maxSpots">Max spots</Label>
                                        <Input
                                            id="maxSpots"
                                            type="number"
                                            min={0}
                                            value={draft.max_spots ?? ""}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "max_spots",
                                                    e.target.value === "" ? null : Number(e.target.value)
                                                )
                                            }
                                            disabled={!draft.rsvp_required}
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Leave blank for unlimited capacity.
                                        </p>
                                    </div>

                                    <div className="max-w-xs">
                                        <Label htmlFor="price">Price</Label>
                                        <Input
                                            id="price"
                                            inputMode="decimal"
                                            value={priceText}
                                            onChange={(e) => setPriceText(e.target.value)}
                                            onBlur={commitPriceFromText}
                                            disabled={!draft.rsvp_required}
                                            placeholder="0.00"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            If price &gt; 0, pick a payment option.
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
                                            disabled={!draft.rsvp_required}
                                            placeholder="(optional)"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <Label>Payment options</Label>
                                    <div
                                        className={`flex flex-wrap gap-4 mt-2 ${!draft.rsvp_required ? "opacity-50 pointer-events-none" : ""
                                            }`}
                                    >
                                        {(["paypal", "door"] as EventPaymentOption[]).map((opt) => {
                                            const arr = draft.payment_options ?? [];
                                            const checked = arr.includes(opt);
                                            return (
                                                <label key={opt} className="flex items-center gap-2 w-32">
                                                    <Checkbox
                                                        checked={!!checked}
                                                        onCheckedChange={(v) => {
                                                            const set = new Set(arr);
                                                            if (v) set.add(opt);
                                                            else set.delete(opt);
                                                            updateDraft("payment_options", Array.from(set));
                                                        }}
                                                        disabled={!draft.rsvp_required}
                                                    />
                                                    <span className="capitalize">{opt}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* refund_policy removed */}
                            </div>
                        </section>

                        {/* GROUP 6: Eligibility */}
                        <section className="space-y-3 border rounded-md p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold">
                                    Who is allowed to attend
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Override</span>
                                    <Switch
                                        checked={!!groupsOn[6]}
                                        onCheckedChange={(v) => toggleGroup(6, !!v)}
                                    />
                                </div>
                            </div>

                            <div className={`grid gap-6 max-w-3xl ${disabledClass(!!groupsOn[6])}`}>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="membersOnly"
                                        checked={!!draft.members_only}
                                        onCheckedChange={(v) =>
                                            updateDraft("members_only", !!v)
                                        }
                                    />
                                    <Label htmlFor="membersOnly">Members only</Label>
                                </div>

                                <div className="max-w-xs">
                                    <Label>Gender</Label>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={draft.gender ?? undefined}
                                            onValueChange={(v) =>
                                                updateDraft("gender", (v as EventGenderOption) || undefined)
                                            }
                                        >
                                            <SelectTrigger className="w-56">
                                                <SelectValue placeholder="All Allowed" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="male">Men only</SelectItem>
                                                <SelectItem value="female">Women only</SelectItem>
                                                <SelectItem value="all">All</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 max-w-md">
                                    <div className="w-32">
                                        <Label htmlFor="minAge">Min age</Label>
                                        <Input
                                            id="minAge"
                                            type="number"
                                            min={0}
                                            value={draft.min_age ?? ""}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "min_age",
                                                    e.target.value === "" ? null : Number(e.target.value)
                                                )
                                            }
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
                                                updateDraft(
                                                    "max_age",
                                                    e.target.value === "" ? null : Number(e.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* GROUP 7: Visibility */}
                        <section className="space-y-3 border rounded-md p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold">Visibility</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Override</span>
                                    <Switch
                                        checked={!!groupsOn[7]}
                                        onCheckedChange={(v) => toggleGroup(7, !!v)}
                                    />
                                </div>
                            </div>

                            <div className={disabledClass(!!groupsOn[7])}>
                                <div className="grid md:grid-cols-2 gap-6 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="regAllowed"
                                            checked={!!draft.registration_allowed}
                                            onCheckedChange={(v) =>
                                                updateDraft("registration_allowed", !!v)
                                            }
                                        />
                                        <Label htmlFor="regAllowed">Registration allowed</Label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="hidden"
                                            checked={!!draft.hidden}
                                            onCheckedChange={(v) => updateDraft("hidden", !!v)}
                                        />
                                        <Label htmlFor="hidden">Hidden</Label>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
