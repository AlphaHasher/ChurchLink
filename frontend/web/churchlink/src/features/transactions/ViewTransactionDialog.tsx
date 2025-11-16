import { Eye } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import type { TransactionSummary } from "@/shared/types/Transactions";
import {
    SoftPill,
    formatKindWithExtras,
    getStatusDisplay,
} from "./MyTransactionsFormatting";
import { useNavigate } from "react-router-dom";

type Props = {
    tx: TransactionSummary;
};

function formatDateTime(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-4 text-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
            </span>
            <span className="text-right break-all">{value ?? "—"}</span>
        </div>
    );
}

// Per-line-item status pill (events)
function getLineItemStatus(line: any): { label: string; className: string } {
    const rawStatus = line.status as string | undefined;
    const amount = Number(line.unit_price ?? line.unitPrice ?? 0) || 0;
    const refunds = Array.isArray(line.refunds) ? line.refunds : [];
    const refundedTotal =
        typeof line.refunded_total === "number"
            ? line.refunded_total
            : refunds.reduce(
                (acc: number, r: any) => acc + Number(r.amount ?? 0),
                0,
            );

    if (refundedTotal > 0 && amount > 0) {
        if (refundedTotal >= amount) {
            return {
                label: "Refunded",
                className: "bg-sky-50 text-sky-700",
            };
        }
        return {
            label: "Partially Refunded",
            className: "bg-amber-50 text-amber-700",
        };
    }

    if (rawStatus) {
        return getStatusDisplay(rawStatus, "event");
    }

    return {
        label: "Paid",
        className: "bg-emerald-50 text-emerald-700",
    };
}

function KindSpecificDetails({ tx }: { tx: TransactionSummary }) {
    const extra = tx.extra || {};

    switch (tx.kind) {
        case "donation_one_time":
            return (
                <div className="space-y-2">
                    <DetailRow label="Message" value={extra.message || "—"} />
                </div>
            );

        case "donation_subscription": {
            const rawInterval =
                (extra.interval as string | undefined) ||
                (extra.meta && (extra.meta.interval as string | undefined)) ||
                (extra.meta && (extra.meta.billing_cycle as string | undefined));

            return (
                <div className="space-y-2">
                    <DetailRow label="Billing Interval" value={rawInterval || "—"} />
                    <DetailRow label="Message" value={extra.message || "—"} />
                </div>
            );
        }

        case "donation_subscription_payment": {
            const subId = extra.subscription_id || tx.paypal_subscription_id;
            return (
                <div className="space-y-2">
                    <DetailRow label="Plan Subscription ID" value={subId || "—"} />
                </div>
            );
        }

        case "event": {
            const eventId = extra.event_id || extra.eventId;
            const instanceId = extra.event_instance_id || extra.eventInstanceId;
            const itemsCount = extra.items_count ?? extra.itemsCount;
            const lineItems =
                (extra.line_items as any[] | undefined) ||
                (extra.lineItems as any[] | undefined) ||
                [];

            return (
                <div className="space-y-3">
                    <DetailRow label="Event ID" value={eventId || "—"} />
                    <DetailRow label="Instance ID" value={instanceId || "—"} />
                    <DetailRow
                        label="Line Items"
                        value={
                            typeof itemsCount === "number"
                                ? itemsCount
                                : lineItems.length || "—"
                        }
                    />

                    {lineItems.length > 0 && (
                        <div className="mt-3 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Line Item Breakdown
                            </div>
                            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                                {lineItems.map((li, idx) => {
                                    const name =
                                        li.display_name ??
                                        li.displayName ??
                                        `Line ${idx + 1}`;
                                    const amount = li.unit_price ?? li.unitPrice ?? null;
                                    const refunds = Array.isArray(li.refunds)
                                        ? li.refunds
                                        : [];
                                    const refundedTotal =
                                        typeof li.refunded_total === "number"
                                            ? li.refunded_total
                                            : refunds.reduce(
                                                (acc: number, r: any) =>
                                                    acc + Number(r.amount ?? 0),
                                                0,
                                            );

                                    const pill = getLineItemStatus(li);

                                    return (
                                        <div
                                            key={li.line_id ?? li.person_id ?? idx}
                                            className="flex flex-col gap-1 rounded bg-background px-3 py-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium truncate">
                                                    {name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {amount != null
                                                        ? `USD ${Number(amount).toFixed(2)}`
                                                        : "—"}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <SoftPill className={pill.className}>
                                                    {pill.label}
                                                </SoftPill>
                                                {refundedTotal > 0 && (
                                                    <span>
                                                        Refunded: USD{" "}
                                                        {refundedTotal.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        case "form": {
            const formId = extra.form_id || extra.formId;
            return (
                <div className="space-y-2">
                    <DetailRow label="Form ID" value={formId || "—"} />
                </div>
            );
        }

        default:
            return null;
    }
}

export default function ViewTransactionDialog({ tx }: Props) {
    const navigate = useNavigate();

    const typeLabel = formatKindWithExtras(tx);
    const rawStatus = tx.status;
    const status = getStatusDisplay(rawStatus, tx.kind);

    const extra = tx.extra || {};
    const itemsCount =
        tx.kind === "event"
            ? (extra.items_count as number | undefined) ??
            (extra.itemsCount as number | undefined)
            : 1;

    const eventInstanceId =
        extra.event_instance_id || extra.eventInstanceId || null;

    const currency = tx.currency || "USD";

    // Original/gross amount (what the user paid)
    const originalAmount =
        (typeof tx.gross_amount === "number" ? tx.gross_amount : null) ??
        (typeof tx.amount === "number" ? tx.amount : null);

    // Total refunded
    const refundedTotal =
        typeof tx.refunded_total === "number" ? tx.refunded_total : 0;

    // User-facing net: original - refunded (ignore internal fee accounting)
    const netAmount =
        originalAmount != null
            ? Math.max(0, originalAmount - (refundedTotal || 0))
            : null;

    const handleGoToEvent = () => {
        if (!eventInstanceId) return;
        navigate(`/sharable_events/${eventInstanceId}`);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Eye className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            {/* wider dialog */}
            <DialogContent className="max-w-3xl z-500">
                <DialogHeader>
                    <DialogTitle>{typeLabel}</DialogTitle>
                    <DialogDescription>
                        Transaction details for your {typeLabel.toLowerCase()}.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/40 p-4 text-sm sm:grid-cols-2">
                        <DetailRow
                            label="Original Amount"
                            value={
                                originalAmount != null
                                    ? `${currency} ${originalAmount.toFixed(2)}`
                                    : "—"
                            }
                        />
                        <DetailRow
                            label="Refunded"
                            value={
                                refundedTotal > 0
                                    ? `${currency} ${refundedTotal.toFixed(2)}`
                                    : "—"
                            }
                        />
                        <DetailRow
                            label="Net Amount"
                            value={
                                netAmount != null
                                    ? `${currency} ${netAmount.toFixed(2)}`
                                    : "—"
                            }
                        />
                        <DetailRow label="Items" value={itemsCount ?? "—"} />
                        <DetailRow
                            label="Created"
                            value={formatDateTime(tx.created_at)}
                        />
                        <DetailRow
                            label="Last Updated"
                            value={formatDateTime(tx.updated_at)}
                        />
                        <div className="sm:col-span-2 flex justify-between items-center pt-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Status
                            </span>
                            <SoftPill className={status.className}>
                                {status.label}
                            </SoftPill>
                        </div>
                    </div>

                    {/* Identifiers */}
                    <div className="space-y-2 text-sm">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Identifiers
                        </div>
                        <div className="space-y-2 rounded-md border p-3">
                            <DetailRow
                                label="Order ID"
                                value={tx.paypal_order_id || "—"}
                            />
                            <DetailRow
                                label="Capture ID"
                                value={tx.paypal_capture_id || "—"}
                            />
                            <DetailRow
                                label="Subscription ID"
                                value={tx.paypal_subscription_id || "—"}
                            />
                            <DetailRow label="Internal ID" value={tx.id} />
                        </div>
                    </div>

                    {/* Kind-specific section + simple actions */}
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Additional Info
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                {tx.kind === "event" && eventInstanceId && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleGoToEvent}
                                        className="text-xs"
                                    >
                                        Go to Event
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="rounded-md border p-3">
                            <KindSpecificDetails tx={tx} />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
