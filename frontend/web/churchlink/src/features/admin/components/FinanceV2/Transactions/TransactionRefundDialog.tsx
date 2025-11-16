import { useMemo, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Textarea } from "@/shared/components/ui/textarea";

import type { TransactionSummary } from "@/shared/types/Transactions";

import {
    adminRefundOneTimeDonation,
    adminRefundDonationSubscriptionPayment,
} from "@/helpers/DonationHelper";
import { adminRefundFormPayment } from "@/helpers/FormSubmissionHelper";
import { adminRefundEventTransaction } from "@/helpers/EventRegistrationHelper";

type Props = {
    tx: TransactionSummary;
    onAfterRefund?: () => void;
};

function formatCurrency(amount?: number | null, currency?: string | null) {
    if (amount == null || Number.isNaN(amount)) return "—";
    const code = currency || "USD";
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: code,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${code} ${amount.toFixed(2)}`;
    }
}

export default function TransactionRefundDialog({ tx, onAfterRefund }: Props) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState<string>("");
    const [reason, setReason] = useState<string>("");
    const [busy, setBusy] = useState(false);
    const [resultMsg, setResultMsg] = useState<string | null>(null);
    const [resultOk, setResultOk] = useState<boolean | null>(null);

    // Event-specific UI state
    const [eventMode, setEventMode] = useState<"all" | "lines">("all");
    const [lineSelection, setLineSelection] = useState<Record<string, boolean>>({});
    const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});

    const kind = tx.kind as string;

    const isDonationOneTime = kind === "donation_one_time";
    const isDonationSubPayment = kind === "donation_subscription_payment";
    const isFormPayment = kind === "form";
    const isEventPayment = kind === "event";

    // If this transaction is not refundable, don't render a trigger at all.
    if (!isDonationOneTime && !isDonationSubPayment && !isFormPayment && !isEventPayment) {
        return null;
    }

    const baseAmount = tx.amount ?? null;
    const currency = tx.currency ?? "USD";

    const refundedTotal = tx.refunded_total ?? 0;
    const netAmount =
        tx.net_amount ?? (baseAmount != null ? baseAmount - refundedTotal : null);

    const leftToRefund = Math.max(((baseAmount ?? 0) - refundedTotal), 0)

    const extra: any = tx.extra || {};
    const eventLineItems: any[] = useMemo(() => {
        if (!isEventPayment) return [];
        const items =
            (extra.line_items as any[] | undefined) ||
            (extra.lineItems as any[] | undefined) ||
            [];
        return Array.isArray(items) ? items : [];
    }, [extra, isEventPayment]);

    const friendlyTitle = (() => {
        if (isDonationOneTime) return "Refund one-time donation";
        if (isDonationSubPayment) return "Refund donation plan payment";
        if (isFormPayment) return "Refund form payment";
        if (isEventPayment) return "Refund event payment";
        return "Refund transaction";
    })();

    const friendlyDescription = (() => {
        if (isDonationOneTime) {
            return "Issue a full or partial refund for this one-time donation. This will create a PayPal refund and update the donation ledger.";
        }
        if (isDonationSubPayment) {
            return "Issue a full or partial refund for this specific donation subscription payment. This does not cancel the underlying plan.";
        }
        if (isFormPayment) {
            return "Issue a full or partial refund for this form payment. This will create a PayPal refund and mark the associated response as refunded.";
        }
        if (isEventPayment) {
            return "Refund this event payment. You can refund the entire transaction or target specific line items. WARNING: Refunding this payment will NOT result in an event unregistration.";
        }
        return "Issue a refund for this transaction.";
    })();

    const resetStateAndClose = () => {
        setOpen(false);
        setAmount("");
        setReason("");
        setBusy(false);
        setResultMsg(null);
        setResultOk(null);
        setEventMode("all");
        setLineSelection({});
        setLineAmounts({});
    };

    const handleSubmit = async () => {
        setBusy(true);
        setResultMsg(null);
        setResultOk(null);

        try {
            let msg = "Refund completed.";
            let success = false;

            if (isDonationOneTime) {
                const payload = {
                    paypal_capture_id: tx.paypal_capture_id || "",
                    amount: amount ? Number(amount) : undefined,
                    reason: reason || undefined,
                };
                if (!payload.paypal_capture_id) {
                    msg = "Missing PayPal capture id for this donation.";
                    success = false;
                } else {
                    const res = await adminRefundOneTimeDonation(payload);
                    msg = res.msg || msg;
                    success = !!res.success;
                }
            } else if (isDonationSubPayment) {
                const payload = {
                    paypal_txn_id: tx.paypal_capture_id || "",
                    amount: amount ? Number(amount) : undefined,
                    reason: reason || undefined,
                };
                if (!payload.paypal_txn_id) {
                    msg = "Missing PayPal transaction id for this subscription payment.";
                    success = false;
                } else {
                    const res = await adminRefundDonationSubscriptionPayment(payload);
                    msg = res.msg || msg;
                    success = !!res.success;
                }
            } else if (isFormPayment) {
                const payload = {
                    paypal_capture_id: tx.paypal_capture_id || "",
                    amount: amount ? Number(amount) : undefined,
                    reason: reason || undefined,
                };
                if (!payload.paypal_capture_id) {
                    msg = "Missing PayPal capture id for this form payment.";
                    success = false;
                } else {
                    const res = await adminRefundFormPayment(payload);
                    msg = res.msg || msg;
                    success = !!res.success;
                }
            } else if (isEventPayment) {
                const orderId = tx.paypal_order_id || "";
                if (!orderId) {
                    msg = "Missing order id for this event transaction.";
                    success = false;
                } else if (eventMode === "all") {
                    const payload = {
                        order_id: orderId,
                        refund_all: true as const,
                        refund_amount: amount ? Number(amount) : undefined,
                        line_map: undefined,
                        reason: reason || undefined,
                    };
                    const res = await adminRefundEventTransaction(payload);
                    msg = res.msg || msg;
                    success = !!res.success;
                } else {
                    const lineMap: Record<string, number | null> = {};
                    for (let idx = 0; idx < eventLineItems.length; idx++) {
                        const li = eventLineItems[idx];
                        const key =
                            li.line_id ||
                            li.person_id ||
                            li.id ||
                            String(li._id || li.id || idx);
                        if (!key || !lineSelection[key]) continue;
                        const val = lineAmounts[key];
                        if (val && Number(val) > 0) {
                            lineMap[key] = Number(val);
                        } else {
                            // null means "refund remaining balance" for that line
                            lineMap[key] = null;
                        }
                    }
                    if (!Object.keys(lineMap).length) {
                        setResultMsg("Select at least one line to refund.");
                        setResultOk(false);
                        setBusy(false);
                        return;
                    }

                    const payload = {
                        order_id: orderId,
                        refund_all: false as const,
                        refund_amount: undefined,
                        line_map: lineMap,
                        reason: reason || undefined,
                    };
                    const res = await adminRefundEventTransaction(payload);
                    msg = res.msg || msg;
                    success = !!res.success;
                }
            }

            setResultMsg(msg);
            setResultOk(success);

            // 🔑 NEW: on success, tell the parent to refresh the data
            if (success && onAfterRefund) {
                onAfterRefund();
            }
        } catch (err) {
            console.error("[TransactionRefundDialog] handleSubmit error", err);
            setResultMsg("Unexpected error while issuing refund.");
            setResultOk(false);
        } finally {
            setBusy(false);
        }
    };

    const triggerTitle = (() => {
        if (isEventPayment && eventLineItems.length) {
            return "Refund event payment (supports per-line refunds)";
        }
        return "Refund this payment";
    })();

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : resetStateAndClose())}
        >
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    type="button"
                    title={triggerTitle}
                >
                    <CircleDollarSign className="h-4 w-4" />
                    <span className="sr-only">Refund</span>
                </Button>
            </DialogTrigger>

            <DialogContent className={isEventPayment ? "max-w-2xl" : "max-w-xl"}>
                <DialogHeader>
                    <DialogTitle>{friendlyTitle}</DialogTitle>
                    <DialogDescription>{friendlyDescription}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1 text-sm text-muted-foreground">
                        <div>
                            <span className="font-medium text-foreground">User uid:</span>{" "}
                            {tx.user_uid || "Unknown user"}
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Transaction ID:</span>{" "}
                            {tx.id ?? "—"}
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Original amount:</span>{" "}
                            {formatCurrency(baseAmount, currency)}
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Refunded so far:</span>{" "}
                            {refundedTotal > 0 ? formatCurrency(refundedTotal, currency) : "—"}
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Unrefunded Sum:</span>{" "}
                            {refundedTotal > 0 ? formatCurrency(leftToRefund, currency) : "—"}
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Net Income:</span>{" "}
                            {netAmount != null && !Number.isNaN(netAmount)
                                ? formatCurrency(netAmount, currency)
                                : "—"}
                        </div>
                    </div>

                    {isEventPayment ? (
                        <div className="space-y-3 rounded-md border p-3">
                            <div className="flex flex-wrap items-center gap-4">
                                <Label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={eventMode === "all"}
                                        onCheckedChange={() => setEventMode("all")}
                                    />
                                    Refund entire transaction
                                </Label>
                                <Label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={eventMode === "lines"}
                                        onCheckedChange={() => setEventMode("lines")}
                                    />
                                    Refund specific line items
                                </Label>
                            </div>

                            {eventMode === "all" ? (
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        Refund amount per line (optional)
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="Leave blank to refund the remaining balance for each line"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        If you enter an amount, that amount is refunded on each
                                        PayPal line, up to its remaining balance. Leaving it blank
                                        refunds each line in full.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-muted-foreground">
                                        Select which lines to refund and optionally specify a
                                        partial amount per line. Leaving an amount blank will refund
                                        the remaining balance for that line.
                                    </p>
                                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                        {eventLineItems.length === 0 && (
                                            <div className="text-sm text-muted-foreground">
                                                No line item breakdown available for this
                                                transaction.
                                            </div>
                                        )}
                                        {eventLineItems.map((li, idx) => {
                                            const key =
                                                li.line_id ||
                                                li.person_id ||
                                                li.id ||
                                                String(li._id || li.id || idx);
                                            const label =
                                                li.person_name ||
                                                li.display_name ||
                                                li.ticket_name ||
                                                li.label ||
                                                `Line ${idx + 1}`;
                                            const lineAmount =
                                                typeof li.amount === "number"
                                                    ? li.amount
                                                    : typeof li.price === "number"
                                                        ? li.price
                                                        : null;
                                            const checked = !!lineSelection[key];

                                            return (
                                                <div
                                                    key={key}
                                                    className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(val) =>
                                                            setLineSelection((prev) => ({
                                                                ...prev,
                                                                [key]: !!val,
                                                            }))
                                                        }
                                                    />
                                                    <div className="flex-1 text-sm">
                                                        <div className="font-medium">{label}</div>
                                                        {lineAmount != null && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Line amount:{" "}
                                                                {formatCurrency(
                                                                    lineAmount,
                                                                    currency,
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-28">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            step={0.01}
                                                            disabled={!checked}
                                                            value={lineAmounts[key] ?? ""}
                                                            onChange={(e) =>
                                                                setLineAmounts((prev) => ({
                                                                    ...prev,
                                                                    [key]: e.target.value,
                                                                }))
                                                            }
                                                            placeholder="Full"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3 rounded-md border p-3">
                            <div className="space-y-1">
                                <Label htmlFor="refund-amount" className="text-sm">
                                    Refund amount (optional)
                                </Label>
                                <Input
                                    id="refund-amount"
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Leave blank to refund the remaining balance"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Leaving the amount blank will refund the remaining balance of
                                    this payment, up to the original amount.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="refund-reason" className="text-sm">
                                    Reason (optional)
                                </Label>
                                <Textarea
                                    id="refund-reason"
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Reason for this refund (visible in internal logs only)"
                                />
                            </div>
                        </div>
                    )}

                    {resultMsg && (
                        <div
                            className={
                                resultOk
                                    ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                                    : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                            }
                        >
                            {resultMsg}
                        </div>
                    )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={resetStateAndClose}
                        disabled={busy}
                    >
                        Close
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={busy}>
                        {busy ? "Processing..." : "Confirm refund"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}