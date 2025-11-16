// THIS IS SHARED ACROSS CREATE AND EDIT
// ITS THE INPUTS FOR DISCOUNT CODES, LIKE WHAT THE USER EDITS


import { useEffect, useMemo, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import { Checkbox } from "@/shared/components/ui/checkbox";
import type { DiscountCodeUpdate } from "@/shared/types/Event";

type Props = {
    value?: DiscountCodeUpdate;
    disabled?: boolean;
    onChange?: (next: DiscountCodeUpdate) => void;
};

const blank: DiscountCodeUpdate = {
    name: "",
    description: null,
    code: "",
    is_percent: false,
    discount: 0,
    max_uses: null,
    active: true,
};

export default function DiscountCodeInputs({ value, disabled, onChange }: Props) {
    const [local, setLocal] = useState<DiscountCodeUpdate>(value ?? blank);
    const [discountStr, setDiscountStr] = useState<string>(
        value ? String(value.discount ?? "") : String(blank.discount ?? "")
    );

    useEffect(() => {
        const next = value ?? blank;
        setLocal(next);
        setDiscountStr(
            next.discount === undefined || next.discount === null ? "" : String(next.discount)
        );
    }, [
        value?.name,
        value?.description,
        value?.code,
        value?.is_percent,
        value?.discount,
        value?.max_uses,
        value?.active,
    ]);

    useEffect(() => {
        onChange?.(local);
    }, [local]);

    const discountLabel = useMemo(
        () => (local.is_percent ? "Percent Discount (Above 0 through 100)" : "Fixed Amount (USD, > 0)"),
        [local.is_percent]
    );

    const updateDiscountFromStr = (raw: string) => {
        setDiscountStr(raw);
        if (raw.trim() === "") {
            setLocal((s) => ({ ...s, discount: 0 }));
            return;
        }
        const n = Number(raw);
        if (!Number.isNaN(n)) setLocal((s) => ({ ...s, discount: n }));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <Label>Code</Label>
                    <Input
                        placeholder="e.g. SUMMER25"
                        value={local.code}
                        onChange={(e) => setLocal((s) => ({ ...s, code: e.target.value }))}
                        disabled={disabled}
                    />
                    <p className="text-xs text-muted-foreground">Stored normalized server-side.</p>
                </div>

                {/* Discount type switch */}
                <div className="flex flex-col gap-2">
                    <Label>Discount Type</Label>
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <span className={!local.is_percent ? "font-semibold" : "text-muted-foreground"}>
                            Raw amount ($)
                        </span>
                        <Switch
                            checked={local.is_percent}
                            onCheckedChange={(v: boolean) =>
                                setLocal((s) => ({ ...s, is_percent: Boolean(v) }))
                            }
                            disabled={disabled}
                            aria-label="Toggle percent discount"
                        />
                        <span className={local.is_percent ? "font-semibold" : "text-muted-foreground"}>
                            Percentage (%)
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Toggle to apply a {local.is_percent ? "percentage (e.g. 25% off)" : "raw dollar amount (e.g. $10 off)"}.
                    </p>
                </div>

                <div className="flex flex-col gap-1">
                    <Label>{discountLabel}</Label>
                    <Input
                        type="text"
                        inputMode={local.is_percent ? "numeric" : "decimal"}
                        placeholder={local.is_percent ? "e.g. 25" : "e.g. 10.00"}
                        value={discountStr}
                        onChange={(e) => updateDiscountFromStr(e.target.value)}
                        onBlur={() => {
                            const trimmed = discountStr.trim();
                            if (trimmed === "") return;
                            const n = Number(trimmed);
                            if (!Number.isNaN(n)) {
                                setDiscountStr(String(n));
                                setLocal((s) => ({ ...s, discount: n }));
                            }
                        }}
                        disabled={disabled}
                    />
                </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <Label>Name</Label>
                    <Input
                        placeholder="Internal display name"
                        value={local.name}
                        onChange={(e) => setLocal((s) => ({ ...s, name: e.target.value }))}
                        disabled={disabled}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <Label>Description (optional)</Label>
                    <Textarea
                        placeholder="Explain what this code does or any restrictions."
                        value={local.description ?? ""}
                        onChange={(e) =>
                            setLocal((s) => ({
                                ...s,
                                description: e.target.value.trim() === "" ? null : e.target.value,
                            }))
                        }
                        disabled={disabled}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <Label>Max Uses (optional and per-account)</Label>
                    <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Leave blank for unlimited"
                        value={local.max_uses === null || local.max_uses === undefined ? "" : String(local.max_uses)}
                        onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === "") {
                                setLocal((s) => ({ ...s, max_uses: null }));
                                return;
                            }
                            const n = Number(raw);
                            if (!Number.isNaN(n)) {
                                setLocal((s) => ({ ...s, max_uses: Math.max(1, Math.trunc(n)) }));
                            }
                        }}
                        onBlur={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === "") return;
                            const n = Number(raw);
                            if (Number.isNaN(n)) return;
                            const clamped = Math.max(1, Math.trunc(n));
                            (e.target as HTMLInputElement).value = String(clamped);
                            setLocal((s) => ({ ...s, max_uses: clamped }));
                        }}
                        disabled={disabled}
                    />
                </div>

                {/* Active Checkbox */}
                <div className="flex flex-col gap-1">
                    <Label>Availability</Label>
                    <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox
                            id="active"
                            checked={local.active}
                            onCheckedChange={(v) =>
                                setLocal((s) => ({ ...s, active: Boolean(v) }))
                            }
                            disabled={disabled}
                        />
                        {local.active ? <Label htmlFor="active" className="font-normal">
                            Code is <span className="font-semibold">enabled</span> and can be used for event registration right now
                        </Label> : <Label htmlFor="active" className="font-normal">
                            Code is <span className="font-semibold">disabled</span> and can not be used for event registration right now
                        </Label>}

                    </div>
                </div>
            </div>
        </div>
    );
}
