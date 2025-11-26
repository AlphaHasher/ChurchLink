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
import type {
    TransactionSummary,
    TransactionRefundEntry,
} from "@/shared/types/Transactions";
import {
    SoftPill,
    formatKindWithExtras,
    getStatusDisplay,
} from "@/features/transactions/MyTransactionsFormatting";
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
    const navigate = useNavigate();

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
            const userUid = tx.user_uid;

            const hasAllIds = !!(eventId && instanceId && userUid);
            const registrationPath = hasAllIds
                ? `/admin/events/${eventId}/instance_details/${instanceId}/user_registrations/${userUid}`
                : null;

            return (
                <div className="space-y-3">
                    <DetailRow label="Event ID" value={eventId || "—"} />
                    <DetailRow label="Instance ID" value={instanceId || "—"} />

                    {registrationPath && (
                        <DetailRow
                            label="Registration"
                            value={
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(registrationPath)}
                                >
                                    Go to Registration
                                </Button>
                            }
                        />
                    )}

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
                                        "Registrant";
                                    const amount =
                                        li.unit_price ?? li.unitPrice ?? null;
                                    const refunds = Array.isArray(li.refunds)
                                        ? li.refunds
                                        : [];
                                    const refundedTotal =
                                        typeof li.refunded_total === "number"
                                            ? li.refunded_total
                                            : refunds.reduce(
                                                (acc: number, r: any) =>
                                                    acc +
                                                    Number(r.amount ?? 0),
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
                                                        ? `USD ${Number(
                                                            amount,
                                                        ).toFixed(2)}`
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
                                                        {refundedTotal.toFixed(
                                                            2,
                                                        )}
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

// Refund history row (for each individual refund)
function RefundRow({
    refund,
    currencyFallback,
}: {
    refund: TransactionRefundEntry;
    currencyFallback: string;
}) {
    const currency = refund.currency || currencyFallback;
    const amount = typeof refund.amount === "number" ? refund.amount : NaN;

    const hasReason = !!refund.reason && refund.reason.trim().length > 0;

    const lineBits: string[] = [];
    if (refund.person_display_name) lineBits.push(refund.person_display_name);
    if (refund.person_id) lineBits.push(`person_id: ${refund.person_id}`);
    if (refund.line_id) lineBits.push(`line_id: ${refund.line_id}`);
    const lineInfo = lineBits.join(" — ");

    return (
        <div className="rounded-md border p-3 bg-card text-sm">
            <div>
                <span className="font-medium">Amount:</span>{" "}
                {Number.isFinite(amount)
                    ? `${currency} ${amount.toFixed(2)}`
                    : "—"}
            </div>
            <div>
                <span className="font-medium">Created:</span>{" "}
                {formatDateTime(refund.created_at)}
            </div>
            {refund.by_uid && (
                <div>
                    <span className="font-medium">By:</span>{" "}
                    <span className="break-all">{refund.by_uid}</span>
                </div>
            )}
            {refund.source && (
                <div>
                    <span className="font-medium">Source:</span> {refund.source}
                </div>
            )}
            {lineInfo && (
                <div className="mt-1">
                    <span className="font-medium">Event Line:</span>{" "}
                    {lineInfo}
                </div>
            )}
            {hasReason && (
                <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {refund.reason}
                </div>
            )}
        </div>
    );
}

export default function ViewAdminTransactionDialog({ tx }: Props) {
    const typeLabel = formatKindWithExtras(tx);
    const rawStatus = tx.status;
    const status = getStatusDisplay(rawStatus, tx.kind);
    const extra = tx.extra || {};

    const itemsCount =
        tx.kind === "event"
            ? ((extra.items_count as number | undefined) ??
                (extra.itemsCount as number | undefined))
            : 1;

    const currency = tx.currency || "USD";
    const refunds: TransactionRefundEntry[] = Array.isArray(tx.refunds)
        ? tx.refunds
        : [];

    const gross =
        (typeof tx.gross_amount === "number" ? tx.gross_amount : null) ??
        (typeof tx.amount === "number" ? tx.amount : null);

    const fee =
        typeof tx.fee_amount === "number" ? tx.fee_amount : null;

    const refundedTotal =
        typeof tx.refunded_total === "number" ? tx.refunded_total : 0;

    const netBeforeRefunds =
        typeof tx.net_amount_before_refunds === "number"
            ? tx.net_amount_before_refunds
            : gross != null && fee != null
                ? gross - fee
                : null;

    const netAfterRefunds =
        typeof tx.net_amount === "number"
            ? tx.net_amount
            : netBeforeRefunds != null
                ? netBeforeRefunds - refundedTotal
                : gross != null
                    ? gross - refundedTotal
                    : null;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Review refund request"
                    title="Review refund request">
                    <Eye className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl sm:max-w-[100vh] max-h-[80vh] overflow-y-auto z-500">
                <DialogHeader>
                    <DialogTitle>{typeLabel}</DialogTitle>
                    <DialogDescription>
                        Full transaction details (admin view).
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-6">
                    {/* Money summary */}
                    <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/40 p-4 text-sm sm:grid-cols-3">
                        <DetailRow
                            label="Gross Amount"
                            value={
                                gross != null
                                    ? `${currency} ${gross.toFixed(2)}`
                                    : "—"
                            }
                        />
                        <DetailRow
                            label="PayPal / Processor Fee"
                            value={
                                fee != null
                                    ? `${currency} ${fee.toFixed(2)}`
                                    : "—"
                            }
                        />
                        <DetailRow
                            label="Refunded Total"
                            value={
                                refundedTotal > 0
                                    ? `${currency} ${refundedTotal.toFixed(2)}`
                                    : `${currency} 0.00`
                            }
                        />
                        <DetailRow
                            label="Net Before Refunds"
                            value={
                                netBeforeRefunds != null
                                    ? `${currency} ${netBeforeRefunds.toFixed(
                                        2,
                                    )}`
                                    : "—"
                            }
                        />
                        <DetailRow
                            label="Net After Refunds"
                            value={
                                netAfterRefunds != null
                                    ? `${currency} ${netAfterRefunds.toFixed(
                                        2,
                                    )}`
                                    : "—"
                            }
                        />
                        <DetailRow label="Items" value={itemsCount ?? "—"} />
                        <DetailRow
                            label="Created"
                            value={formatDateTime(tx.created_at)}
                        />
                        <DetailRow
                            label="Updated"
                            value={formatDateTime(tx.updated_at)}
                        />
                        <div className="sm:col-span-3 flex justify-between items-center pt-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Status
                            </span>
                            <SoftPill className={status.className}>
                                {status.label}
                            </SoftPill>
                        </div>
                    </div>

                    {/* Refund history */}
                    {refunds.length > 0 && (
                        <details className="rounded-md border bg-card">
                            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                                Refund History ({refunds.length})
                            </summary>
                            <div className="p-3 space-y-2 max-h-[260px] overflow-y-auto">
                                {refunds
                                    .slice()
                                    .reverse()
                                    .map((r, idx) => (
                                        <RefundRow
                                            key={
                                                r.refund_id ??
                                                `${idx}-${r.created_at ?? ""}`
                                            }
                                            refund={r}
                                            currencyFallback={currency}
                                        />
                                    ))}
                            </div>
                        </details>
                    )}

                    {/* Context / identifiers */}
                    <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                        <div className="space-y-2">
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
                                    value={
                                        tx.paypal_subscription_id || "—"
                                    }
                                />
                                <DetailRow label="Internal ID" value={tx.id} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Context
                            </div>
                            <div className="space-y-2 rounded-md border p-3">
                                <DetailRow
                                    label="User UID"
                                    value={tx.user_uid || "—"}
                                />
                                <DetailRow
                                    label="Source Collection"
                                    value={tx.source_collection}
                                />
                                <DetailRow
                                    label="Kind"
                                    value={`${tx.kind}${tx.extra &&
                                        Object.keys(tx.extra).length > 0
                                        ? " (has extra payload)"
                                        : ""
                                        }`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Kind-specific extra */}
                    <div className="space-y-3 text-sm">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Kind-Specific Details
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
