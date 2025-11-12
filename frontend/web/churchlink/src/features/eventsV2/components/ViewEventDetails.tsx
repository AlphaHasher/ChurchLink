import { useEffect, useMemo, useState, useCallback } from "react";
import {
    Calendar,
    Repeat2,
    Heart,
    Share2,
    Church,
    BadgeDollarSign,
    Users,
    Info,
    ChevronDown,
    Mars,
    Venus,
    IdCard,
    CheckCircle2,
    AlertTriangle,
    Shield,
    Clock
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Card } from "@/shared/components/ui/card";

import { useFetchEventInstanceDetails, setFavorite } from "@/helpers/EventUserHelper";
import { getPublicUrl } from "@/helpers/MediaInteraction";
import EventMapCard from "@/features/eventsV2/components/EventMapCard";
import type { UserFacingEvent, SisterInstanceIdentifier } from "@/shared/types/Event";
import type { Ministry } from "@/shared/types/Ministry";

import RegistrationPaymentModal from "@/features/eventsV2/components/RegistrationPaymentModal";
import EventTicketCard from "@/features/eventsV2/components/EventTicketCard";
import { useAuth } from "@/features/auth/hooks/auth-context";

type Props = {
    instanceId: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    forceOpen?: boolean;
    onFavoriteChanged?: (eventId: string, isFav: boolean) => void;
};

const fmtDateTime = (iso?: string | null) =>
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

const fmtMoney = (n?: number | null) =>
    typeof n === "number"
        ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n)
        : null;

export default function ViewEventDetails({
    instanceId,
    open,
    onOpenChange,
    forceOpen = false,
    onFavoriteChanged,
}: Props) {
    const { fetchEventInstanceDetails } = useFetchEventInstanceDetails();

    const [internalOpen, setInternalOpen] = useState(true);
    const effectiveOpen = forceOpen ? true : open ?? internalOpen;

    useEffect(() => {
        if (effectiveOpen) {
            setActiveInstanceId(instanceId);
        }
    }, [effectiveOpen, instanceId]);

    const [activeInstanceId, setActiveInstanceId] = useState(instanceId);
    useEffect(() => {
        setActiveInstanceId(instanceId);
    }, [instanceId]);

    const [loading, setLoading] = useState(true);
    const [payload, setPayload] = useState<{
        success: boolean;
        msg: string;
        event_details: UserFacingEvent | null;
        sister_details: SisterInstanceIdentifier[];
        ministries: Ministry[];
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [isFav, setIsFav] = useState(false);

    const [busyFav, setBusyFav] = useState(false);
    const [shareMsg, setShareMsg] = useState<string | null>(null);

    const [showRegistration, setShowRegistration] = useState(false);

    const load = useCallback(
        async (id: string) => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetchEventInstanceDetails(id);
                setPayload({
                    success: !!res?.success,
                    msg: res?.msg ?? "",
                    event_details: res?.event_details ?? null,
                    sister_details: res?.sister_details ?? [],
                    ministries: res?.ministries ?? [],
                });
                if (res?.event_details) setIsFav(!!res.event_details.is_favorited);
            } catch (e: any) {
                setError(e?.message ?? "Failed to load event");
            } finally {
                setLoading(false);
            }
        },
        [fetchEventInstanceDetails]
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await load(activeInstanceId);
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
    }, [activeInstanceId, load]);

    function handleOpenChange(val: boolean) {
        if (forceOpen) return;
        onOpenChange?.(val);
        setInternalOpen(val);
        if (!val) setShowRegistration(false);
    }

    const rawHost = import.meta.env.VITE_WEB_DOMAIN?.trim();
    const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const baseUrl = rawHost && rawHost.length > 0 ? rawHost : fallbackOrigin;
    const sharableURL = baseUrl
        ? `${baseUrl}/sharable_events/${payload?.event_details?.id}`
        : "";

    return (
        <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[82vh] z-200 overflow-y-auto p-0 rounded-xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Event details</DialogTitle>
                    <DialogDescription>Full details for the selected event instance.</DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="p-6 animate-pulse">
                        <div className="h-48 w-full rounded-xl bg-muted" />
                        <div className="mt-6 h-8 w-1/2 rounded bg-muted" />
                        <div className="mt-3 h-4 w-2/3 rounded bg-muted" />
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="h-32 rounded bg-muted" />
                            <div className="h-32 rounded bg-muted" />
                            <div className="h-32 rounded bg-muted" />
                        </div>
                    </div>
                )}

                {!loading && (!payload?.success || !payload?.event_details) && (
                    <div className="p-8 flex flex-col items-center text-center gap-4">
                        <div className="text-2xl font-semibold">No event found</div>
                        <p className="max-w-prose text-muted-foreground">
                            The event you’re looking for doesn’t exist anymore or isn’t available.
                        </p>
                        <button
                            onClick={() => handleOpenChange(false)}
                            className="px-4 py-2 rounded-md border bg-background hover:bg-accent"
                        >
                            Close
                        </button>
                    </div>
                )}

                {!loading && !error && payload?.event_details && (
                    <>
                        {showRegistration ? (
                            <div className="p-5 md:p-6">
                                <RegistrationPaymentModal
                                    inline
                                    instanceId={activeInstanceId}
                                    event={payload.event_details}
                                    onBack={() => setShowRegistration(false)}
                                    onError={(msg) => console.error("[registration] error:", msg)}
                                    onSuccess={() => {
                                        setShowRegistration(false);
                                        load(activeInstanceId);
                                    }}
                                />
                            </div>
                        ) : (
                            <EventDetailsBody
                                data={payload.event_details}
                                sisterDetails={payload.sister_details}
                                ministries={payload.ministries}
                                isFav={isFav}
                                busyFav={busyFav}
                                onToggleFavorite={async () => {
                                    if (busyFav || !payload?.event_details) return;
                                    setBusyFav(true);
                                    try {
                                        const next = !isFav;
                                        const ok = await setFavorite(payload.event_details.event_id, next);
                                        if (ok) {
                                            setIsFav(next);
                                            onFavoriteChanged?.(payload.event_details.event_id, next)
                                        }
                                    } finally {
                                        setBusyFav(false);
                                    }
                                }}
                                onShare={async () => {
                                    try {
                                        await navigator.clipboard.writeText(sharableURL);
                                        setShareMsg("Event link copied to your clipboard");
                                        setTimeout(() => setShareMsg(null), 1400);
                                    } catch {
                                        setShareMsg("Could not copy. Sorry!");
                                        setTimeout(() => setShareMsg(null), 1400);
                                    }
                                }}
                                shareMsg={shareMsg}
                                onSelectSister={(id) => {
                                    if (!id || id === activeInstanceId) return;
                                    setActiveInstanceId(id);
                                }}
                                onOpenRegistration={() => setShowRegistration(true)}
                            />
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function EventDetailsBody({
    data,
    sisterDetails,
    ministries,
    isFav,
    busyFav,
    onToggleFavorite,
    onShare,
    shareMsg,
    onSelectSister,
    onOpenRegistration,
}: {
    data: UserFacingEvent;
    sisterDetails: SisterInstanceIdentifier[];
    ministries: Ministry[];
    isFav: boolean;
    busyFav: boolean;
    onToggleFavorite: () => Promise<void> | void;
    onShare: () => Promise<void> | void;
    shareMsg: string | null;
    onSelectSister: (id: string) => void;
    onOpenRegistration: () => void;
}) {
    const priceIsNumber = typeof data.price === "number";
    const memberIsNumber = typeof data.member_price === "number";

    const stdIsZero = priceIsNumber && data.price === 0;
    const memberIsZero = memberIsNumber && data.member_price === 0;

    const ministryNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        (ministries ?? []).forEach((m) => {
            if (m?.id && m?.name) map[m.id] = m.name;
        });
        return map;
    }, [ministries]);

    const heroUrl = data.image_id ? getPublicUrl(data.image_id) : null;
    const isRecurring = !!(data.recurring && data.recurring !== "never");

    const otherSisters = useMemo(() => {
        const curId = data?.id;
        return (sisterDetails || []).filter((s) => s?.id && s.id !== curId);
    }, [sisterDetails, data?.id]);

    const [openSisters, setOpenSisters] = useState(false);
    useEffect(() => {
        setOpenSisters(false);
    }, [data?.id]);

    const maxSpots = typeof data.max_spots === "number" ? data.max_spots : 0;
    const seats = typeof data.seats_filled === "number" ? data.seats_filled : 0;
    const remaining = Math.max(0, maxSpots - seats);
    const isFull = maxSpots > 0 && seats >= maxSpots;

    const { user } = useAuth();

    return (
        <div className="flex flex-col">
            <div
                className="w-full shrink-0 flex items-center justify-center bg-neutral-950"
            >
                {heroUrl ? (
                    <img
                        src={heroUrl}
                        alt={data.default_title || "Event image"}
                        className=" block w-full h-auto object-contain max-h-[60vh] min-h-[15rem] md:min-h-[20rem] lg:min-h-[22rem]"
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    <div className="h-[15rem] md:h-[20rem] lg:h-[22rem] w-full" />
                )}
            </div>

            {/* Header */}
            <div className="px-5 md:px-8 py-5 border-b bg-background/95">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {data.default_title || "(Untitled Event)"}
                        </h1>

                        {Array.isArray(data.ministries) && data.ministries.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <Church className="h-4 w-4" />
                                <span>
                                    {(data.ministries as string[]).map((id) => ministryNameMap[id] || id).join(" • ")}
                                </span>
                            </div>
                        )}

                        {data.default_description && (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-6">
                                {data.default_description}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={onShare} className="gap-2">
                            <Share2 className="h-4 w-4" />
                            Share
                        </Button>
                        <Button
                            onClick={onToggleFavorite}
                            disabled={busyFav}
                            className={isFav ? "gap-2 bg-rose-600 hover:bg-rose-600/90" : "gap-2"}
                            variant={isFav ? "default" : "outline"}
                        >
                            <Heart className={`h-4 w-4 ${isFav ? "fill-white" : ""}`} />
                            {isFav ? "Favorited" : "Favorite"}
                        </Button>
                    </div>
                </div>

                {shareMsg && (
                    <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                        {shareMsg}
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 md:p-8">
                {/* LEFT COLUMN ON CARDS */}
                <div className="md:col-span-8 space-y-6">
                    {/* Schedule */}
                    <Card className="px-5">
                        <div className="flex items-center gap-2 font-semibold">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            Schedule
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="min-w-0 space-y-2">
                                {data.end_date ? (
                                    <div className="space-y-1">
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Start Time</div>
                                        <div className="text-base font-medium">{fmtDateTime(data.date)}</div>
                                        <div className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">End Time</div>
                                        <div className="text-base font-medium">{fmtDateTime(data.end_date)}</div>
                                    </div>
                                ) : (
                                    <div className="text-base font-medium">{fmtDateTime(data.date)}</div>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {isRecurring ? (
                                        <Badge className="bg-indigo-600 text-white inline-flex items-center gap-1">
                                            <Repeat2 className="h-3.5 w-3.5" />
                                            <span className="whitespace-nowrap">Repeats {data.recurring}</span>
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-white/90 text-slate-700 border border-slate-200">
                                            One-time
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {otherSisters.length > 0 && (
                            <div className="border-t pt-4">
                                <button
                                    type="button"
                                    onClick={() => setOpenSisters((v) => !v)}
                                    className="w-full flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent text-sm"
                                    aria-expanded={openSisters}
                                >
                                    <span className="font-medium">
                                        Other upcoming events in the series
                                        <span className="ml-2 text-muted-foreground">({otherSisters.length})</span>
                                    </span>
                                    <ChevronDown className={`h-4 w-4 transition-transform ${openSisters ? "rotate-180" : ""}`} />
                                </button>

                                {openSisters && (
                                    <div className="mt-2 space-y-2">
                                        {otherSisters.map((s) => (
                                            <div
                                                key={s.id}
                                                className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent"
                                            >
                                                <div className="text-sm">
                                                    <div className="font-medium">{fmtDateTime(s.date || null)}</div>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => onSelectSister(s.id)}>
                                                    View
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Allowed Attendance */}
                    <Card className="px-5">
                        <div className="flex items-center gap-2 font-semibold">
                            <IdCard className="h-4 w-4 text-muted-foreground" />
                            Allowed Attendance
                        </div>

                        <div className="grid grid-cols-[7.5rem_1fr] items-center gap-x-3 gap-y-2">
                            <div className="text-sm text-muted-foreground">Membership:</div>
                            <div className="min-h-[2rem] flex items-center">
                                {data.members_only ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border bg-purple-50 text-purple-700 border-purple-200 text-[13px] px-2.5 py-1.5">
                                        <IdCard className="h-4 w-4" />
                                        Members Only
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] px-2.5 py-1.5">
                                        <Users className="h-4 w-4" />
                                        Members &amp; Non-Members Allowed
                                    </span>
                                )}
                            </div>

                            <div className="text-sm text-muted-foreground">Gender:</div>
                            <div className="min-h-[2rem] flex items-center">
                                {String((data.gender || "all")).toLowerCase() === "male" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-[13px] px-2.5 py-1.5">
                                        <Mars className="h-4 w-4" />
                                        Men Only
                                    </span>
                                ) : String((data.gender || "all")).toLowerCase() === "female" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-pink-200 bg-pink-50 text-pink-700 text-[13px] px-2.5 py-1.5">
                                        <Venus className="h-4 w-4" />
                                        Women Only
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] px-2.5 py-1.5">
                                        <Users className="h-4 w-4" />
                                        Both Genders Allowed
                                    </span>
                                )}
                            </div>

                            <div className="text-sm text-muted-foreground">Age Range:</div>
                            <div className="min-h-[2rem] flex items-center">
                                {typeof data.min_age !== "number" && typeof data.max_age !== "number" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700 text-[13px] px-2.5 py-1.5">
                                        All Ages
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700 text-[13px] px-2.5 py-1.5">
                                        {typeof data.min_age === "number" && typeof data.max_age === "number"
                                            ? `${data.min_age}-${data.max_age} Years Old`
                                            : typeof data.min_age === "number"
                                                ? `${data.min_age} Years Old and Over`
                                                : `${data.max_age} Years Old and Under`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* RIGHT COLUMN OF CARDS */}
                <div className="md:col-span-4 space-y-6">
                    {/* Pricing */}
                    <Card className="px-5">
                        <div className="flex items-center gap-2 font-semibold">
                            <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
                            Pricing
                        </div>

                        {stdIsZero ? (
                            <Badge className="w-fit bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Free
                            </Badge>
                        ) : (
                            <div className="text-sm text-foreground/90 space-y-1">
                                {priceIsNumber && data.price! > 0 && (
                                    <div>
                                        Standard Price: <span className="font-semibold">{fmtMoney(data.price)}</span>
                                    </div>
                                )}
                                {memberIsNumber && (
                                    <div className="flex items-center gap-2">
                                        <span>Member Price:</span>
                                        {memberIsZero ? (
                                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Free
                                            </Badge>
                                        ) : (
                                            <span className="font-semibold">{fmtMoney(data.member_price)}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Event Capacity */}
                    {data.rsvp_required && (<Card className="px-5">
                        <div className="flex items-center gap-2 font-semibold">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            Event Capacity
                        </div>

                        {/* Registration requirement */}
                        <div className="text-sm">
                            {data.rsvp_required ? (
                                <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                                    Registration Required
                                </Badge>
                            ) : (
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    No Registration Required
                                </Badge>
                            )}
                        </div>

                        {/* Capacity status */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Unlimited when no RSVP or max_spots === 0 */}
                            {!data.rsvp_required || maxSpots === 0 ? (
                                <Badge className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Unlimited Event Capacity
                                </Badge>
                            ) : (
                                <>
                                    {/* Event Reg: seats / max */}
                                    <Badge className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 border border-slate-200">
                                        <Users className="h-4 w-4" />
                                        Event Reg:&nbsp;
                                        <span className="font-semibold">
                                            {seats} / {maxSpots}
                                        </span>
                                    </Badge>

                                    {/* Spots left / full */}
                                    {isFull ? (
                                        <Badge className="inline-flex items-center gap-1 bg-rose-600 text-white">
                                            <AlertTriangle className="h-4 w-4" />
                                            EVENT FULL
                                        </Badge>
                                    ) : (
                                        <Badge className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <CheckCircle2 className="h-4 w-4" />
                                            {remaining} Spots Left
                                        </Badge>
                                    )}
                                </>
                            )}
                        </div>
                    </Card>)}

                    {/* Registration */}
                    {data.rsvp_required && (
                        <Card className="px-5">
                            {/* Header */}
                            <div className="flex items-center gap-2 font-semibold">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                Registration
                            </div>

                            {/* Ownership badge: its own section, independent spacing */}
                            <div
                                className={`mt-2 inline-flex items-center gap-2 rounded-md px-3 py-2 border text-[13px] ${data.has_registrations
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-slate-50 border-slate-200 text-slate-700"
                                    }`}
                            >
                                {data.has_registrations ? (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>You have registrations for this event</span>
                                    </>
                                ) : (
                                    <>
                                        <Info className="h-4 w-4" />
                                        <span>You do not have registrations for this event</span>
                                    </>
                                )}
                            </div>

                            {/* Rest of registration info lives in its own block */}
                            <div className="mt-3 text-sm text-foreground/90 space-y-1">
                                {(() => {
                                    const now = new Date();
                                    const opens = data.registration_opens ? new Date(data.registration_opens) : null;
                                    const deadline = data.registration_deadline ? new Date(data.registration_deadline) : null;

                                    type RegPhase = "closed" | "not_open_yet" | "deadline_passed" | "open";
                                    const regPhase: RegPhase = !data.registration_allowed
                                        ? "closed"
                                        : (opens && now < opens) ? "not_open_yet"
                                            : (deadline && now > deadline) ? "deadline_passed"
                                                : "open";

                                    let statusEl: React.ReactNode = null;
                                    if (regPhase === "closed") {
                                        statusEl = (
                                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                                <Shield className="h-4 w-4" />
                                                Registration Closed
                                            </Badge>
                                        );
                                    } else if (regPhase === "not_open_yet") {
                                        statusEl = (
                                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                Registration Not Open
                                            </Badge>
                                        );
                                    } else if (regPhase === "deadline_passed") {
                                        statusEl = (
                                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                                <AlertTriangle className="h-4 w-4" />
                                                Registration Deadline Passed
                                            </Badge>
                                        );
                                    } else {
                                        statusEl = (
                                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Registration Open
                                            </Badge>
                                        );
                                    }

                                    return (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">Status:</span>
                                                {statusEl}
                                            </div>

                                            {data.registration_opens && (
                                                <div>
                                                    Opens: <span className="font-medium">{fmtDateTime(data.registration_opens)}</span>
                                                </div>
                                            )}
                                            {data.registration_deadline && (
                                                <div>
                                                    Deadline: <span className="font-medium">{fmtDateTime(data.registration_deadline)}</span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <Separator className="my-3" />

                            {/* Primary action */}
                            <Button
                                className="w-full gap-2"
                                onClick={onOpenRegistration}
                            >
                                <Users className="h-4 w-4" />
                                {data.has_registrations ? "View Registration" : "Register"}
                            </Button>
                        </Card>
                    )}

                    {/* Ticket — only if signed in AND the viewer has registrations for this event */}
                    {user && data.has_registrations && (
                        <EventTicketCard
                            instance={data}
                            userId={user.uid}
                        />
                    )}


                </div>
            </div>

            <div className="px-5 md:px-8 pb-6 md:pb-8">
                {/* BIG MAP CARD AT BOTTOM */}
                <EventMapCard locationInfo={data.default_location_info} locationAddress={data.location_address} />
            </div>
        </div>
    );
}
