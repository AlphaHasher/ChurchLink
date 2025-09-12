import * as React from "react";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/shared/components/ui/select";

export type Gender = "M" | "F" | "";

export type PersonInfo = {
    firstName: string;
    lastName: string;
    dob: { mm: string; dd: string; yyyy: string };
    gender: Gender;
};

type PersonInfoInputProps = {
    value: PersonInfo;
    onChange: (next: PersonInfo) => void;
    idPrefix?: string;
    disabled?: boolean;
    className?: string;
};

export const PersonInfoInput: React.FC<PersonInfoInputProps> = ({
    value,
    onChange,
    idPrefix = "person",
    disabled,
    className,
}) => {
    const onlyDigits = (s: string) => s.replace(/\D/g, "");
    const clamp = (n: number, min: number, max: number) =>
        Math.min(max, Math.max(min, n));

    const pad2 = (s: string) => (s.length === 1 ? `0${s}` : s);
    const daysInMonth = (year: number, month1to12: number) =>
        new Date(year, month1to12, 0).getDate();

    const currentYear = new Date().getFullYear();

    const update = (patch: Partial<PersonInfo>) => onChange({ ...value, ...patch });
    const updateDob = (patch: Partial<PersonInfo["dob"]>) =>
        onChange({ ...value, dob: { ...value.dob, ...patch } });

    // Adjust DD when MM or YYYY changes to keep it in a valid range
    React.useEffect(() => {
        const mmNum = parseInt(value.dob.mm || "0", 10);
        const yyNum = parseInt(value.dob.yyyy || "2000", 10);
        const ddNum = parseInt(value.dob.dd || "0", 10);

        if (!mmNum || !yyNum || !ddNum) return;

        const max = daysInMonth(yyNum, mmNum);
        if (ddNum > max) {
            updateDob({ dd: pad2(String(max)) });
        }
    }, [value.dob.mm, value.dob.yyyy]); // eslint-disable-line react-hooks/exhaustive-deps

    const onChangeMM = (raw: string) => {
        let s = onlyDigits(raw).slice(0, 2);
        if (s.length === 2) {
            const n = clamp(parseInt(s, 10) || 0, 1, 12);
            s = pad2(String(n));
        }
        updateDob({ mm: s });
    };

    const onBlurMM = () => {
        if (!value.dob.mm) return;
        let n = clamp(parseInt(value.dob.mm, 10) || 0, 1, 12);
        updateDob({ mm: pad2(String(n)) });
    };

    const onChangeDD = (raw: string) => {
        let s = onlyDigits(raw).slice(0, 2);
        if (s.length === 2) {
            const mmNum = clamp(parseInt(value.dob.mm || "0", 10) || 1, 1, 12);
            const yyNum = clamp(parseInt(value.dob.yyyy || "2000", 10) || 2000, 1900, currentYear);
            const max = daysInMonth(yyNum, mmNum);
            const n = clamp(parseInt(s, 10) || 0, 1, max);
            s = pad2(String(n));
        }
        updateDob({ dd: s });
    };

    const onBlurDD = () => {
        if (!value.dob.dd) return;
        const mmNum = clamp(parseInt(value.dob.mm || "0", 10) || 1, 1, 12);
        const yyNum = clamp(parseInt(value.dob.yyyy || "2000", 10) || 2000, 1900, currentYear);
        const max = daysInMonth(yyNum, mmNum);
        let n = clamp(parseInt(value.dob.dd, 10) || 0, 1, max);
        updateDob({ dd: pad2(String(n)) });
    };

    const onChangeYYYY = (raw: string) => {
        let s = onlyDigits(raw).slice(0, 4);
        if (s.length === 4) {
            const n = clamp(parseInt(s, 10) || 0, 1900, currentYear);
            s = String(n);
        }
        updateDob({ yyyy: s });
    };

    const onBlurYYYY = () => {
        if (!value.dob.yyyy) return;
        let n = clamp(parseInt(value.dob.yyyy, 10) || 0, 1900, currentYear);
        updateDob({ yyyy: String(n) });
    };

    return (
        <div className={["space-y-6", className].filter(Boolean).join(" ")}>
            {/* Full Name */}
            <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor={`${idPrefix}-firstName`} className="text-xs text-muted-foreground">
                            First name
                        </Label>
                        <Input
                            id={`${idPrefix}-firstName`}
                            value={value.firstName}
                            onChange={(e) => update({ firstName: e.target.value })}
                            placeholder="First"
                            disabled={disabled}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${idPrefix}-lastName`} className="text-xs text-muted-foreground">
                            Last name
                        </Label>
                        <Input
                            id={`${idPrefix}-lastName`}
                            value={value.lastName}
                            onChange={(e) => update({ lastName: e.target.value })}
                            placeholder="Last"
                            disabled={disabled}
                        />
                    </div>
                </div>
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
                <Label>Date of Birth</Label>
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <Label htmlFor={`${idPrefix}-dob-mm`} className="text-xs text-muted-foreground">
                            MM
                        </Label>
                        <Input
                            id={`${idPrefix}-dob-mm`}
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={2}
                            placeholder="MM"
                            value={value.dob.mm}
                            onChange={(e) => onChangeMM(e.target.value)}
                            onBlur={onBlurMM}
                            disabled={disabled}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${idPrefix}-dob-dd`} className="text-xs text-muted-foreground">
                            DD
                        </Label>
                        <Input
                            id={`${idPrefix}-dob-dd`}
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={2}
                            placeholder="DD"
                            value={value.dob.dd}
                            onChange={(e) => onChangeDD(e.target.value)}
                            onBlur={onBlurDD}
                            disabled={disabled}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${idPrefix}-dob-yyyy`} className="text-xs text-muted-foreground">
                            YYYY
                        </Label>
                        <Input
                            id={`${idPrefix}-dob-yyyy`}
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={4}
                            placeholder="YYYY"
                            value={value.dob.yyyy}
                            onChange={(e) => onChangeYYYY(e.target.value)}
                            onBlur={onBlurYYYY}
                            disabled={disabled}
                        />
                    </div>
                </div>
            </div>

            {/* Gender */}
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-gender`}>Gender</Label>
                <Select
                    value={value.gender}
                    onValueChange={(v) => update({ gender: v as Gender })}
                    disabled={disabled}
                >
                    <SelectTrigger
                        id={`${idPrefix}-gender`}
                        className="!w-full !h-10 !bg-background !text-foreground appearance-none !px-3 !py-2 data-[placeholder]:text-muted-foreground"
                    >
                        <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="z-50 max-h-60">
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="F">F</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};