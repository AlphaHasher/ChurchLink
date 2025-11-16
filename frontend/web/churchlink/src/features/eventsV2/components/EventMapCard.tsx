import * as React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { MapPin, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useLanguage } from "@/provider/LanguageProvider"; // <-- add this

type Props = {
    locationInfo?: string | null;
    locationAddress?: string | null; // treated as plain text query (Ideally Name, Address)
    className?: string;
};

const EventMapCard: React.FC<Props> = ({ locationInfo, locationAddress, className }) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API as string | undefined;
    const localize = useLocalize();
    const locale = useLanguage().locale;

    const src = React.useMemo(() => {
        const q = (locationAddress || "").trim();
        if (!apiKey || !q) return null;

        const encodedQuery = encodeURIComponent(q);

        // Normalize locale to simple language code like "en", "ru", "es"
        const lang = (locale || "en").split("-")[0];

        return `https://www.google.com/maps/embed/v1/search` +
            `?key=${apiKey}` +
            `&q=${encodedQuery}` +
            `&language=${encodeURIComponent(lang)}`;
        // If you ever want to bias region too:
        // + `&region=${lang === "en" ? "US" : lang.toUpperCase()}`
    }, [apiKey, locationAddress, locale]);

    const showMap = !!src;

    return (
        <Card className={cn("px-5", className)}>
            {/* Match ViewEventDetails card header style */}
            <div className="flex items-center gap-2 font-semibold">
                <MapIcon className="h-4 w-4 text-muted-foreground" />
                {localize("Location")}
            </div>

            <CardContent className="space-y-4 px-0">
                {/* Embedded map using text query only */}
                {showMap ? (
                    <div className="overflow-hidden rounded-lg ring-1 ring-border">
                        <iframe
                            title="Event location map"
                            src={src!}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className="h-[340px] w-full border-0 md:h-[420px]"
                            allowFullScreen
                        />
                    </div>
                ) : (
                    <div className="grid h-[280px] w-full place-items-center rounded-lg bg-muted text-sm text-muted-foreground ring-1 ring-border md:h-[340px]">
                        {localize("No Map Provided")}
                    </div>
                )}

                {/* Pindrop + address + optional description */}
                <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                        <p className="m-0 break-words whitespace-pre-wrap text-sm leading-5 text-foreground">
                            {locationAddress || "—"}
                        </p>

                        {locationInfo ? (
                            <p className="m-0 mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                {locationInfo}
                            </p>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default EventMapCard;
