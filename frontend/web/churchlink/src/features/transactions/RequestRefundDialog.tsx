// RequestRefundDialog.tsx
// User-facing dialog to create a refund request for an event or form payment.

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { BanknoteArrowDown, Loader2, Info } from "lucide-react";

import type { TransactionSummary } from "@/shared/types/Transactions";
import { SoftPill, formatKindWithExtras, getStatusDisplay } from "./MyTransactionsFormatting";
import { createRefundRequest } from "@/helpers/RefundRequestHelper";

type Props = {
    tx: TransactionSummary;
    onSubmitted?: () => void;
};

function formatDate(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function RequestRefundDialog({ tx, onSubmitted }: Props) {
    const [open, setOpen] = React.useState(false);
    const [message, setMessage] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const isRefundableKind = tx.kind === "event" || tx.kind === "form";

    const typeLabel =
        tx.kind === "event"
            ? "event payment"
            : tx.kind === "form"
                ? "form payment"
                : "transaction";

    const originalAmount =
        (typeof tx.gross_amount === "number" ? tx.gross_amount : null) ??
        (typeof tx.amount === "number" ? tx.amount : null);

    const refundedTotal =
        typeof tx.refunded_total === "number" ? tx.refunded_total : 0;

    const netAmount =
        originalAmount != null
            ? Math.max(0, originalAmount - (refundedTotal || 0))
            : null;

    const currency = tx.currency || "USD";
    const status = getStatusDisplay(tx.status, tx.kind);

    React.useEffect(() => {
        if (!open) return;
        setMessage("");
        setError(null);
    }, [open]);

    const handleSubmit = async () => {
        const trimmed = message.trim();
        if (!trimmed) {
            setError("Please describe what you are asking for with this refund request.");
            return;
        }

        if (!isRefundableKind) {
            setError("Only event and form transactions may be used for refund requests.");
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const payload = {
                txn_kind: tx.kind as "event" | "form",
                txn_id: tx.id,
                message: trimmed,
            };

            const result = await createRefundRequest(payload);
            if (!result.success) {
                setError(result.msg || "Failed to submit refund request. Please try again.");
                return;
            }

            setOpen(false);
            onSubmitted?.();
        } catch (err) {
            console.error("[RequestRefundDialog] handleSubmit() error", err);
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isRefundableKind) {
        // Extra safety, though the button shouldn't show for other kinds.
        return null;
    }

    const label =
        tx.kind === "event"
            ? "Request refund for this event payment"
            : "Request refund for this form payment";

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title={label}>
                    <BanknoteArrowDown className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Request Refund</DialogTitle>
                    <DialogDescription>
                        {`You're requesting a refund for this ${typeLabel}. Use the message box below to explain what you're asking for (partial refund, full refund, specific line items, etc.).`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Transaction summary */}
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Transaction
                                </div>
                                <div className="font-medium">{formatKindWithExtras(tx)}</div>
                                <div className="text-xs text-muted-foreground">
                                    Internal ID: <span className="break-all">{tx.id}</span>
                                </div>
                            </div>
                            <SoftPill className={status.className}>{status.label}</SoftPill>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div>
                                <Label>Original Amount</Label>
                                <div>
                                    {originalAmount != null
                                        ? `${currency} ${originalAmount.toFixed(2)}`
                                        : "—"}
                                </div>
                            </div>
                            <div>
                                <Label>Refunded so far</Label>
                                <div>
                                    {refundedTotal > 0
                                        ? `${currency} ${refundedTotal.toFixed(2)}`
                                        : "—"}
                                </div>
                            </div>
                            <div>
                                <Label>Net Amount</Label>
                                <div>
                                    {netAmount != null
                                        ? `${currency} ${netAmount.toFixed(2)}`
                                        : "—"}
                                </div>
                            </div>
                            <div>
                                <Label>Created</Label>
                                <div>{formatDate(tx.created_at)}</div>
                            </div>
                            <div>
                                <Label>Last Updated</Label>
                                <div>{formatDate(tx.updated_at)}</div>
                            </div>
                        </div>

                        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                            <Info className="mt-0.5 h-4 w-4" />
                            <span>
                                This dialog does not immediately move money. An admin will review
                                your request and either process an appropriate refund or respond
                                with more questions.
                            </span>
                        </div>
                    </div>

                    {/* Message + errors */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="refund-request-message">Describe your request</Label>
                        <Textarea
                            id="refund-request-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={5}
                            placeholder="For example: “I’d like a refund for one ticket because I can no longer attend”, or “Please refund $4.00 because …”"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        disabled={submitting}
                    >
                        Close
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
