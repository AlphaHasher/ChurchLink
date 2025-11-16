// THIS IS A CARD THAT ALLOWS A USER TO APPLY DISCOUNT CODES WHEN SIGNING UP FOR EVENTS

import { useState, useEffect } from "react";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useLanguage } from "@/provider/LanguageProvider";

type Props = {
    applying: boolean;
    applied: null | {
        id: string;
        is_percent: boolean;
        discount: number;
        uses_left: number | null;
    };
    error: string | null;

    onApply: (rawCode: string) => Promise<void>;
    onClear: () => void;
};

function prettyDiscount(isPercent: boolean, discount: number, localize: any = useLocalize(), lang: string = useLanguage().locale): string {
    if (lang === "en") {
        return isPercent ? `${discount}% off` : `$${discount.toFixed(2)} off`;
    }
    else {
        if (isPercent) {
            return `${discount} ${localize("Removed from price")}`;
        }
        else {
            return `${localize("Removed from price")}: $${discount.toFixed(2)}`;
        }
    }
}

export default function ApplyDiscountCodes({
    applying,
    applied,
    error,
    onApply,
    onClear,
}: Props) {
    const localize = useLocalize();
    const lang = useLanguage().locale;
    const [code, setCode] = useState("");

    // clear input when a code successfully applies
    useEffect(() => {
        if (applied) setCode("");
    }, [applied]);

    let checking: string;
    let usesLeft: string;
    if (lang === "en") {
        checking = "Checking…";
        if (applied != null) {
            usesLeft = `${applied.uses_left || 0} use${applied.uses_left === 1 ? "" : "s"} left`
        }
        else {
            usesLeft = "";
        }

    }
    else {
        checking = localize("Checking Discount Code…");
        if (applied != null) {
            usesLeft = localize("The amount of uses remaining is:") + ` ${applied!.uses_left || 0}`;
        }
        else {
            usesLeft = "";
        }
    }

    return (
        <Card className="p-4">
            <div className="mb-2 font-semibold">{localize("Discount Codes")}</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                    placeholder={localize("Enter discount code")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={applying}
                    className="sm:max-w-[320px]"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && code.trim()) onApply(code.trim());
                    }}
                />
                <div className="flex gap-2">
                    <Button
                        onClick={() => onApply(code.trim())}
                        disabled={applying || !code.trim()}
                    >
                        {applying ? checking : localize("Apply Discount Code")}
                    </Button>
                    {applied && (
                        <Button variant="outline" onClick={onClear} disabled={applying}>
                            {localize("Remove")}
                        </Button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mt-2 text-sm text-rose-700">{localize("This discount code cannot be applied!")}</div>
            )}

            {/* Success summary */}
            {applied && !error && (
                <div className="mt-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {prettyDiscount(applied.is_percent, applied.discount, localize, lang)}
                        </Badge>

                        <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                            {applied.uses_left == null
                                ? localize("Unlimited uses")
                                : usesLeft}
                        </Badge>
                    </div>

                    <p className="mt-2 text-muted-foreground">
                        {localize("Prices below will reflect the discount across all selected attendees. The discount will be applied evenly across all persons. You may only use 1 discount code per transaction.")}
                    </p>
                </div>
            )}
        </Card>
    );
}
