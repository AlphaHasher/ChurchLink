// THIS IS A CARD THAT ALLOWS A USER TO APPLY DISCOUNT CODES WHEN SIGNING UP FOR EVENTS

import { useState, useEffect } from "react";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";

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

function prettyDiscount(isPercent: boolean, discount: number) {
    return isPercent ? `${discount}% off` : `$${discount.toFixed(2)} off`;
}

export default function ApplyDiscountCodes({
    applying,
    applied,
    error,
    onApply,
    onClear,
}: Props) {
    const [code, setCode] = useState("");

    // clear input when a code successfully applies
    useEffect(() => {
        if (applied) setCode("");
    }, [applied]);

    return (
        <Card className="p-4">
            <div className="mb-2 font-semibold">Discount Codes</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                    placeholder="Enter discount code"
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
                        {applying ? "Checking…" : "Apply Discount Code"}
                    </Button>
                    {applied && (
                        <Button variant="outline" onClick={onClear} disabled={applying}>
                            Remove
                        </Button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mt-2 text-sm text-rose-700">{error}</div>
            )}

            {/* Success summary */}
            {applied && !error && (
                <div className="mt-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {prettyDiscount(applied.is_percent, applied.discount)}
                        </Badge>

                        <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                            {applied.uses_left == null
                                ? "Unlimited uses"
                                : `${applied.uses_left} use${applied.uses_left === 1 ? "" : "s"} left`}
                        </Badge>
                    </div>

                    <p className="mt-2 text-muted-foreground">
                        Prices below will reflect the discount across all selected attendees. The discount will be applied evenly across all persons. You may only use 1 discount code per transaction.
                    </p>
                </div>
            )}
        </Card>
    );
}
