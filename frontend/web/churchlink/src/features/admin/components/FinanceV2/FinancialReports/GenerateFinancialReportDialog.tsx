// GenerateFinancialReportDialog.tsx
// Admin dialog to configure and generate a financial report.

import { useMemo, useState } from "react";
import { FileBarChart2, Loader2, Info, Calendar as CalendarIcon } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Textarea } from "@/shared/components/ui/textarea";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Calendar } from "@/shared/components/ui/calendar";

import type {
    FinancialReportConfig,
    GenerateFinancialReportResponse,
} from "@/shared/types/FinancialReport";
import type { TransactionKind } from "@/shared/types/Transactions";

import { generateFinancialReport } from "@/helpers/FinancialReportHelper";
import {
    getStatusFilterOptionsForKind,
    type StatusFilterOption,
} from "@/features/transactions/MyTransactionsFormatting";

type Props = {
    onCreated?: (report: GenerateFinancialReportResponse) => void;
};

const ALL_KINDS: TransactionKind[] = [
    "donation_one_time",
    "donation_subscription",
    "donation_subscription_payment",
    "event",
    "form",
];

function prettyKind(kind: TransactionKind): string {
    switch (kind) {
        case "donation_one_time":
            return "Donation (one-time)";
        case "donation_subscription":
            return "Donation Plan";
        case "donation_subscription_payment":
            return "Donation Plan Payment";
        case "event":
            return "Event Payment";
        case "form":
            return "Form Payment";
        default:
            return kind;
    }
}

function formatDateLabel(value: Date | null): string {
    if (!value) return "Any date";
    return value.toLocaleDateString();
}

// Build a local start-of-day datetime with offset, e.g. "2025-11-15T00:00:00-08:00"
function toLocalStartOfDayWithOffset(value: Date | null): string | null {
    if (!value) return null;

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    // Local midnight in the current timezone
    const localMidnight = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0);

    const offsetMinutes = localMidnight.getTimezoneOffset(); // minutes behind UTC
    const sign = offsetMinutes <= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(abs / 60)).padStart(2, "0");
    const offsetMins = String(abs % 60).padStart(2, "0");

    const offset = `${sign}${offsetHours}:${offsetMins}`;
    const hours = "00";
    const minutes = "00";
    const seconds = "00";

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
}

type DatePickerFieldProps = {
    label: string;
    value: Date | null;
    onChange: (value: Date | null) => void;
    helperText?: string;
};

function DatePickerField({ label, value, onChange, helperText }: DatePickerFieldProps) {
    return (
        <div className="flex flex-col gap-1">
            <Label>{label}</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-full justify-between text-left font-normal"
                    >
                        <span>{formatDateLabel(value)}</span>
                        <CalendarIcon className="h-4 w-4 opacity-70" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[999]" align="start">
                    <Calendar
                        mode="single"
                        selected={value ?? undefined}
                        onSelect={(d) => onChange(d ?? null)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
            {helperText && (
                <p className="text-xs text-muted-foreground">{helperText}</p>
            )}
        </div>
    );
}

export default function GenerateFinancialReportDialog({ onCreated }: Props) {
    const [open, setOpen] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const [kindSelection, setKindSelection] = useState<TransactionKind[]>([...ALL_KINDS]);

    // Status abstraction: multi-select over status families.
    const statusOptions: StatusFilterOption[] = useMemo(
        () => getStatusFilterOptionsForKind("all"),
        [],
    );
    // Selected status option IDs. "all" means no explicit filter.
    const [statusFilterIds, setStatusFilterIds] = useState<string[]>(["all"]);
    const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);

    // Date range via shadcn pickers (local dates)
    const [createdFrom, setCreatedFrom] = useState<Date | null>(null);
    const [createdTo, setCreatedTo] = useState<Date | null>(null);

    const [includeRefundRequests, setIncludeRefundRequests] = useState<boolean>(true);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedKindsLabel = useMemo(() => {
        if (!kindSelection.length) return "No kinds selected";
        if (kindSelection.length === ALL_KINDS.length) return "All kinds";
        return `${kindSelection.length} selected`;
    }, [kindSelection]);

    const statusSummaryLabel = useMemo(() => {
        if (!statusFilterIds.length || statusFilterIds.includes("all")) {
            return "All statuses";
        }
        if (statusFilterIds.length === 1) {
            const opt = statusOptions.find((o) => o.id === statusFilterIds[0]);
            return opt?.label ?? "1 status group selected";
        }
        return `${statusFilterIds.length} status groups selected`;
    }, [statusFilterIds, statusOptions]);

    const resetState = () => {
        setName("");
        setDescription("");
        setKindSelection([...ALL_KINDS]);
        setStatusFilterIds(["all"]);
        setCreatedFrom(null);
        setCreatedTo(null);
        setIncludeRefundRequests(true);
        setError(null);
    };

    const handleOpenChange = (value: boolean) => {
        if (!value) {
            setOpen(false);
            resetState();
        } else {
            setOpen(true);
        }
    };

    const buildConfig = (): FinancialReportConfig => {
        // If "all" is selected or nothing selected, send null for statuses (no filter).
        if (!statusFilterIds.length || statusFilterIds.includes("all")) {
            return {
                name: name.trim() || null,
                description: description.trim() || null,
                kinds: kindSelection.length ? kindSelection : null,
                statuses: null,
                created_from: toLocalStartOfDayWithOffset(createdFrom),
                created_to: toLocalStartOfDayWithOffset(createdTo),
                include_refund_requests: includeRefundRequests,
                include_breakdown_by_kind: true,
                include_breakdown_by_currency: false,
            };
        }

        const activeOptions = statusOptions.filter((o) =>
            statusFilterIds.includes(o.id),
        );

        const mergedStatuses = Array.from(
            new Set(activeOptions.flatMap((o) => o.statuses)),
        );

        const statuses: string[] | null =
            mergedStatuses.length === 0 ? null : mergedStatuses;

        return {
            name: name.trim() || null,
            description: description.trim() || null,
            kinds: kindSelection.length ? kindSelection : null,
            statuses,
            created_from: toLocalStartOfDayWithOffset(createdFrom),
            created_to: toLocalStartOfDayWithOffset(createdTo),
            include_refund_requests: includeRefundRequests,
            include_breakdown_by_kind: true,
            include_breakdown_by_currency: false,
        };
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);

        try {
            const config = buildConfig();
            const report = await generateFinancialReport(config);
            onCreated?.(report);
            setOpen(false);
            resetState();
        } catch (err: any) {
            console.error("[GenerateFinancialReportDialog] error", err);
            setError(
                err?.message ||
                "Failed to generate report. Please try again or adjust the filters.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const toggleStatusOption = (opt: StatusFilterOption, nextChecked: boolean) => {
        setStatusFilterIds((prev) => {
            // Turning on "all" wipes others.
            if (nextChecked && opt.id === "all") {
                return ["all"];
            }

            // Turning off an option.
            if (!nextChecked) {
                const without = prev.filter((id) => id !== opt.id);
                // If nothing left, fall back to "all".
                return without.length ? without : ["all"];
            }

            // Turning on a non-"all" option.
            const withoutAll = prev.filter((id) => id !== "all");
            if (withoutAll.includes(opt.id)) return withoutAll;
            return [...withoutAll, opt.id];
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <FileBarChart2 className="mr-2 h-4 w-4" />
                    Generate Report
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl z-[999]">
                <DialogHeader>
                    <DialogTitle>Generate Financial Report</DialogTitle>
                    <DialogDescription>
                        Choose what to include in the report. Depending on the time
                        range and filters, generation can take a noticeable amount of
                        time.
                    </DialogDescription>
                </DialogHeader>

                {/* Inner scroll container so dropdowns behave */}
                <div className="max-h-[70vh] overflow-y-auto space-y-5">
                    <Alert className="border-amber-500/40 bg-amber-500/10">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="ml-2 text-xs">
                            Generating a detailed financial report may take a while,
                            especially for large date ranges. You can continue working in
                            other tabs, but don&apos;t close this window until the report
                            finishes.
                        </AlertDescription>
                    </Alert>

                    {/* Name + status filter + description */}
                    <section className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="fr-name">Report name</Label>
                                <Input
                                    id="fr-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Q4 2025 Giving Overview"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <Label>Status filter (optional)</Label>
                                <Popover
                                    open={statusPopoverOpen}
                                    onOpenChange={setStatusPopoverOpen}
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-between text-left font-normal"
                                        >
                                            <span>{statusSummaryLabel}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-72 max-h-64 overflow-y-auto p-2 z-[1100]"
                                        align="start"
                                    >
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">
                                                Choose one or more status groups. If &quot;All
                                                statuses&quot; is selected, other choices are
                                                ignored.
                                            </p>
                                            <div className="space-y-1">
                                                {statusOptions.map((opt) => {
                                                    const checked =
                                                        statusFilterIds.includes(opt.id) ||
                                                        (!statusFilterIds.length &&
                                                            opt.id === "all");
                                                    return (
                                                        <label
                                                            key={opt.id}
                                                            className="flex items-center gap-2 text-sm"
                                                        >
                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={(v) =>
                                                                    toggleStatusOption(
                                                                        opt,
                                                                        !!v,
                                                                    )
                                                                }
                                                            />
                                                            <span>{opt.label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-2 flex items-center justify-between border-t pt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setStatusFilterIds(["all"])
                                                    }
                                                >
                                                    Reset to all
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setStatusPopoverOpen(false)
                                                    }
                                                >
                                                    Done
                                                </Button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <p className="text-xs text-muted-foreground">
                                    These options mirror the transaction statuses you see in
                                    the transactions table, and are converted internally to
                                    the underlying ledger values. If you want a quick view of
                                    the actual finances generated and do not understand the fine
                                    details, selecting "Paid", "Refunded", and "Partially Refunded"
                                    is the recommended setting to get a breakdown of finances.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label htmlFor="fr-description">
                                Description (optional)
                            </Label>
                            <Textarea
                                id="fr-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Short note about what this report covers..."
                            />
                        </div>
                    </section>

                    {/* Transaction kinds + date range */}
                    <section className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium">
                                        Transaction kinds
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {selectedKindsLabel}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Choose which kinds of transactions to include in this
                                    report. If none are selected, nothing will be included.
                                </p>
                                <div className="mt-2 grid grid-cols-1 gap-1">
                                    {ALL_KINDS.map((k) => {
                                        const checked = kindSelection.includes(k);
                                        return (
                                            <label
                                                key={k}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={(v) => {
                                                        const next = !!v;
                                                        setKindSelection((prev) => {
                                                            if (next) {
                                                                if (prev.includes(k)) return prev;
                                                                return [...prev, k];
                                                            } else {
                                                                return prev.filter(
                                                                    (x) => x !== k,
                                                                );
                                                            }
                                                        });
                                                    }}
                                                />
                                                <span>{prettyKind(k)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
                                <div className="text-sm font-medium">
                                    Transaction date range
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Filter on the creation date of transactions included in
                                    this report. If left blank, all dates are included.
                                </p>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <DatePickerField
                                        label="From (local start of day)"
                                        value={createdFrom}
                                        onChange={setCreatedFrom}
                                        helperText="Inclusive lower bound."
                                    />
                                    <DatePickerField
                                        label="To (local start of day)"
                                        value={createdTo}
                                        onChange={setCreatedTo}
                                        helperText="Inclusive upper bound."
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Contents toggles */}
                    <section className="space-y-2">
                        <Label className="text-sm">Report contents</Label>
                        <div className="grid gap-2 md:grid-cols-2">
                            <label className="flex items-start gap-2 text-sm">
                                <Checkbox
                                    checked={includeRefundRequests}
                                    onCheckedChange={(v) =>
                                        setIncludeRefundRequests(!!v)
                                    }
                                />
                                <span>
                                    Include refund request summary
                                    <span className="block text-xs text-muted-foreground">
                                        Counts and states of refund requests in the same
                                        window.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </section>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription className="text-xs">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Generate report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
