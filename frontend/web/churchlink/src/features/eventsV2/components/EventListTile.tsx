import * as React from "react";
import {
    Calendar,
    MapPin,
    Repeat2,
    BadgeDollarSign,
    Heart,
    Mars,
    Venus,
    IdCard,
    Church,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { UserFacingEvent } from "@/shared/types/Event";
import { getPublicUrl } from "@/helpers/MediaInteraction";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { setFavorite } from "@/helpers/EventUserHelper";
import ViewEventDetails from "@/features/eventsV2/components/ViewEventDetails";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useLanguage } from "@/provider/LanguageProvider";

type Props = {
    event: UserFacingEvent;
    ministryNameMap?: Record<string, string>;
    onFavoriteChanged?: (eventId: string, newIsFav: boolean) => void;
    disabled?: boolean;
};

const formatCurrency = (n: number) =>
    new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
    }).format(n);

function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function PriceBadge(ev: UserFacingEvent) {
    const localize = useLocalize();
    const lang = useLanguage().locale;

    const price = typeof ev.price === "number" ? ev.price : 0;
    const member = typeof ev.member_price === "number" ? ev.member_price : null;

    const hasPaymentOptions =
        Array.isArray(ev.payment_options) && ev.payment_options.length > 0;
    const paid = (price > 0 || (member !== null && member > 0)) && hasPaymentOptions;

    let free: string;

    if (lang === "en") {
        free = "FREE";
    }

    else {
        free = "NO COST";
    }

    if (!paid) {
        return (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                {localize(free)}
            </Badge>
        );
    }

    if (member !== null) {
        return (
            <Badge
                variant="secondary"
                className="bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"
            >
                <BadgeDollarSign className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">
                    {formatCurrency(price)} <span className="font-medium">{localize("Standard Price")}</span>
                </span>
                <span className="opacity-60 px-1">&amp;</span>
                <span className="whitespace-nowrap">

                    {(member === 0) ? localize(free) : formatCurrency(member)} <span className="font-medium">{localize("Member Price")}</span>
                </span>
            </Badge>
        );
    }

    return (
        <Badge
            variant="secondary"
            className="bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"
        >
            <BadgeDollarSign className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">
                {formatCurrency(price)} <span className="font-medium">{localize("Standard Price")}</span>
            </span>
        </Badge>
    );
}

function GenderBadge(ev: UserFacingEvent) {
    const localize = useLocalize();

    const g = (ev.gender || "all").toLowerCase();
    if (g === "male") {
        return (
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                <Mars className="h-3.5 w-3.5" />
                {localize("Men Only")}
            </Badge>
        );
    }
    if (g === "female") {
        return (
            <Badge className="bg-pink-50 text-pink-700 border border-pink-200 inline-flex items-center gap-1">
                <Venus className="h-3.5 w-3.5" />
                {localize("Women Only")}
            </Badge>
        );
    }
    return null;
}

function AgeBadge(ev: UserFacingEvent) {
    const localize = useLocalize();
    const hasMin = typeof ev.min_age === "number";
    const hasMax = typeof ev.max_age === "number";
    if (!hasMin && !hasMax) return null;

    let label = "";
    if (hasMin && hasMax) label = `${ev.min_age}-${ev.max_age} ${localize("Years Old")}`;
    else if (hasMin) label = `${ev.min_age} ${localize("Years Old and Over")}`;
    else label = `${ev.max_age} ${localize("Years Old and Under")}`;

    return (
        <Badge className="bg-slate-50 text-slate-700 border border-slate-200">
            {label}
        </Badge>
    );
}

function MembersOnlyBadge(ev: UserFacingEvent) {
    const localize = useLocalize();
    if (!ev.members_only) return null;
    return (
        <Badge className="bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
            <IdCard className="h-3.5 w-3.5" />
            {localize("Members Only")}
        </Badge>
    );
}

export const EventListTile: React.FC<Props> = ({
    event,
    ministryNameMap,
    onFavoriteChanged,
    disabled,
}) => {
    const localize = useLocalize();
    const lang = useLanguage().locale;
    const is_preferred = event.default_localization === lang;

    const heroUrl = event.image_id ? getPublicUrl(event.image_id) : null;
    const isRecurring = event.recurring && event.recurring !== "never";

    const auth = useAuth();
    const isSignedIn =
        !!(auth as any)?.user ||
        !!(auth as any)?.currentUser ||
        !!(auth as any)?.uid;

    const [isFav, setIsFav] = React.useState<boolean>(!!event.is_favorited);
    const [busy, setBusy] = React.useState<boolean>(false);
    const [showDetails, setShowDetails] = React.useState<boolean>(false);

    React.useEffect(() => {
        setIsFav(!!event.is_favorited);
    }, [event.is_favorited]);

    async function onToggleFavorite() {
        if (!isSignedIn || busy || disabled) return;
        try {
            setBusy(true);
            const next = !isFav;
            const ok = await setFavorite(event.event_id, next);
            if (ok) {
                setIsFav(next);
                onFavoriteChanged?.(event.event_id, next);
            }
        } finally {
            setBusy(false);
        }
    }

    let title: string;
    let desc: string;

    if (is_preferred) {
        title = event.default_title;
        desc = event.default_description;
    }

    else {
        title = localize(event.default_title);
        desc = localize(event.default_description);
    }

    return (
        <Card className="h-full flex flex-col overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition">
            {/* Image Header with layered blur effect */}
            <div className="relative overflow-hidden">
                {/* Blurred background layer (zoomed) */}
                <div
                    className="absolute inset-0 w-full h-full bg-center"
                    style={{
                        backgroundImage: heroUrl
                            ? `url("${heroUrl}")`
                            : `linear-gradient(45deg,var(--background),var(--muted))`,
                        backgroundSize: "cover",
                        backgroundRepeat: "no-repeat",
                        filter: heroUrl ? "blur(25px)" : "none",
                        transform: "scale(1.0)", // Adjustable: 1.0 = 100% zoom (default)
                    }}
                />
                {/* Sharp foreground layer */}
                <div
                    className="relative w-full aspect-[16/9] bg-center"
                    style={{
                        backgroundImage: heroUrl
                            ? `url("${heroUrl}")`
                            : `linear-gradient(45deg,var(--background),var(--muted))`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                    }}
                />
                {/* Top-right badges: favorited (left) + recurrence (right) */}
                <div className="absolute top-2 right-2 flex gap-2">
                    {isFav && (
                        <Badge className="bg-rose-600 text-white inline-flex items-center gap-1 shadow-sm">
                            <Heart className="h-3.5 w-3.5 fill-white" />
                            {localize("Favorited")}
                        </Badge>
                    )}
                    {isRecurring ? (
                        <Badge className="bg-indigo-600 text-white inline-flex items-center gap-1">
                            <Repeat2 className="h-3.5 w-3.5" />
                            {localize(`Repeats ${event.recurring}`)}
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-white/90 text-slate-700 border border-slate-200">
                            {localize("One-time")}
                        </Badge>
                    )}
                </div>
            </div>

            <CardHeader className="pt-3 pb-0">
                <h3 className="text-lg font-semibold leading-snug line-clamp-2 text-slate-900">
                    {title || "(Untitled Event)"}
                </h3>
            </CardHeader>

            <CardContent className="space-y-2 flex-1 flex flex-col">
                {/* Date */}
                <div className="flex items-start gap-2 text-slate-700">
                    <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="text-sm font-medium">{localize(formatDateTime(event.date))}</span>
                </div>

                {/* Location */}
                {event.location_address ? (
                    <div className="flex items-start gap-2 text-slate-700">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="text-sm break-words">{event.location_address}</span>
                    </div>
                ) : null}

                {/* Ministries */}
                {Array.isArray(event.ministries) && event.ministries.length > 0 ? (
                    <div className="flex items-start gap-2 text-slate-700">
                        <Church className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="text-sm line-clamp-1">
                            {(event.ministries as string[])
                                .map((id) => ministryNameMap?.[id] ?? id)
                                .join(" • ")}
                        </span>
                    </div>
                ) : null}

                {/* Description */}
                {event.default_description ? (
                    <p className="text-sm text-slate-600 line-clamp-3">{desc}</p>
                ) : null}

                {/* Meta badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    {event.rsvp_required ? (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200">
                            {localize("Registration Required")}
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {localize("No Registration Required")}
                        </Badge>
                    )}
                    <PriceBadge {...event} />
                    <GenderBadge {...event} />
                    <AgeBadge {...event} />
                    <MembersOnlyBadge {...event} />
                </div>

                {/* Action Buttons: Toggle Favorites and Show Details */}
                <div className="mt-auto space-y-2 pt-4">
                    {isSignedIn ? (
                        <>
                            {/* Muted red add/remove favorite */}
                            <Button
                                onClick={onToggleFavorite}
                                disabled={busy || disabled}
                                className={`w-full h-11 inline-flex items-center justify-center gap-2 ${isFav
                                    ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
                                    : "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-500/90 focus-visible:ring-rose-400/40"
                                    }`}
                            >
                                <Heart
                                    className={`h-4 w-4 ${isFav ? "text-slate-700" : "text-white"} ${!isFav ? "fill-white" : ""}`}
                                />
                                {busy ? localize("Working…") : isFav ? localize("Remove from Favorites") : localize("Add to Favorites")}
                            </Button>

                            {/* Default-colored Show Details */}
                            <Button className="w-full h-11" onClick={() => setShowDetails(true)}>
                                {localize("Show Details")}
                            </Button>
                        </>
                    ) : (
                        // Not signed in: only Show Details
                        <Button className="w-full h-11" onClick={() => setShowDetails(true)}>
                            {localize("Show Details")}
                        </Button>
                    )}
                </div>
            </CardContent>

            {/* Event Details Dialog (Show Details) */}
            <ViewEventDetails
                instanceId={event.id}
                open={showDetails}
                onOpenChange={setShowDetails}
                onFavoriteChanged={onFavoriteChanged}
            />
        </Card>
    );
};
