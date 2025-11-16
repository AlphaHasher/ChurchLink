// RefundRequestResponseDialog.tsx
// Displays the details and resolution of a particular refund request,
// and allows the user to submit a *new* refund request for the same transaction.

import { useMemo, useState } from "react";
import { Info, MessageCircle, Eye, Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Label } from "@/shared/components/ui/label";

import { SoftPill, formatKindWithExtras, getStatusDisplay } from "../MyTransactionsFormatting";

import type {
    RefundRequestWithTransaction,
    RefundRequestHistoryItem,
} from "@/shared/types/RefundRequest";
import ViewTransactionDialog from "../ViewTransactionDialog";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Textarea } from "@/shared/components/ui/textarea";
import { createRefundRequest } from "@/helpers/RefundRequestHelper";

function formatDate(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function deriveStatusPill(req: RefundRequestWithTransaction): {
    label: string;
    className: string;
} {
    if (!req.responded) {
        return { label: "Pending", className: "bg-amber-50 text-amber-700" };
    }
    if (req.resolved) {
        return { label: "Resolved", className: "bg-emerald-50 text-emerald-700" };
    }
    return { label: "Unresolved", className: "bg-slate-50 text-slate-700" };
}

function HistoryItemRow({ item }: { item: RefundRequestHistoryItem }) {
    const statusLabel = !item.responded
        ? "Pending"
        : item.resolved
            ? "Resolved"
            : "Unresolved";

    return (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Previous state
                </div>
                <span className="text-xs text-muted-foreground">
                    {formatDate(item.created_on)}
                </span>
            </div>
            <div className="mb-2 flex items-center gap-2">
                <SoftPill
                    className={
                        !item.responded
                            ? "bg-amber-50 text-amber-700"
                            : item.resolved
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-50 text-slate-700"
                    }
                >
                    {statusLabel}
                </SoftPill>
                {item.responded_to && (
                    <span className="text-xs text-muted-foreground">
                        Responded: {formatDate(item.responded_to)}
                    </span>
                )}
            </div>
            <div className="mb-1">
                <span className="font-medium">Your message:</span>
                <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {item.message?.trim() || "No message was recorded at this time."}
                </div>
            </div>
            <div className="mt-2">
                <span className="font-medium">Admin response:</span>
                <div className="mt-1 whitespace-pre-wrap">
                    {item.reason?.trim() || "No response was recorded at this time."}
                </div>
            </div>
        </div>
    );
}

type Props = {
    request: RefundRequestWithTransaction;
    // parent can refresh list when a *new* request gets submitted from here
    onAfterNewRequest?: () => void;
};

export default function RefundRequestResponseDialog({
    request,
    onAfterNewRequest,
}: Props) {
    const [open, setOpen] = useState(false);

    const currentStatus = useMemo(() => deriveStatusPill(request), [request]);
    const tx = request.transaction || null;

    const statusDisplay = tx ? getStatusDisplay(tx.status, tx.kind) : null;
    const typeLabel = tx ? formatKindWithExtras(tx) : request.txn_kind.toUpperCase();

    const hasAdminResponse = !!request.responded;

    const responseText =
        request.reason && request.reason.trim().length > 0
            ? request.reason.trim()
            : hasAdminResponse
                ? "No specific reason was recorded by the admin."
                : "This refund request has not yet been responded to.";

    // inline “new request” state
    const [newMessage, setNewMessage] = useState("");
    const [submittingNew, setSubmittingNew] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

    const isRefundableKind = tx && (tx.kind === "event" || tx.kind === "form");

    const handleSubmitNewRequest = async () => {
        const trimmed = newMessage.trim();
        if (!trimmed) {
            setSubmitError("Please describe what you are asking for in this new request.");
            setSubmitSuccess(null);
            return;
        }

        if (!tx || !isRefundableKind) {
            setSubmitError(
                "This transaction is not eligible for a refund request from this screen.",
            );
            setSubmitSuccess(null);
            return;
        }

        try {
            setSubmittingNew(true);
            setSubmitError(null);
            setSubmitSuccess(null);

            const payload = {
                txn_kind: tx.kind as "event" | "form",
                txn_id: tx.id,
                message: trimmed,
            };

            const result = await createRefundRequest(payload);
            if (!result.success) {
                setSubmitError(
                    result.msg || "Failed to submit a new refund request. Please try again.",
                );
                setSubmitSuccess(null);
                return;
            }

            setNewMessage("");
            setSubmitSuccess("Your new refund request has been submitted.");
            setSubmitError(null);
            onAfterNewRequest?.();
        } catch (err) {
            console.error("[RefundRequestResponseDialog] handleSubmitNewRequest error", err);
            setSubmitError("Something went wrong while submitting your new request.");
            setSubmitSuccess(null);
        } finally {
            setSubmittingNew(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Eye className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            {/* High z-index so header/nav doesn't clip this */}
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto z-[999]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Refund Request Details
                    </DialogTitle>
                    <DialogDescription>
                        Read the status and any responses related to your refund request. You can
                        also submit another refund request for the same payment if needed.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Current state */}
                    <div className="rounded-md border bg-muted/40 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <SoftPill className={currentStatus.className}>
                                    {currentStatus.label}
                                </SoftPill>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Submitted: {formatDate(request.created_on)}
                                {request.responded_to && (
                                    <>
                                        {" • "}Responded: {formatDate(request.responded_to)}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                            <div>
                                <Label>Transaction Type</Label>
                                <div>{typeLabel}</div>
                            </div>
                            <div>
                                <Label>Transaction ID</Label>
                                <div className="break-all">
                                    {tx?.id || request.txn_id || "—"}
                                </div>
                            </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="grid gap-2">
                            <Label>Your message</Label>
                            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {request.message?.trim()
                                    ? request.message
                                    : "No message was provided for this request."}
                            </div>
                        </div>
                    </div>

                    {/* Admin response */}
                    <div className="rounded-md border border-muted-foreground/30 bg-muted/40 p-3">
                        <div className="mb-2 flex items-start gap-2">
                            <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <div className="text-sm font-medium">Admin response</div>
                                <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                    {responseText}
                                </div>
                            </div>
                        </div>

                        {!hasAdminResponse && (
                            <Alert className="mt-2 border-amber-500/30 bg-amber-500/10">
                                <AlertDescription className="text-xs">
                                    Once an admin reviews this request, their decision and any
                                    notes will appear here.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Transaction snapshot */}
                    {tx && (
                        <div className="rounded-md border bg-muted/40 p-3 text-sm">
                            <div className="mb-2 flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Transaction Overview
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        This is the payment associated with this refund request.
                                    </div>
                                </div>
                                {statusDisplay && (
                                    <SoftPill className={statusDisplay.className}>
                                        {statusDisplay.label}
                                    </SoftPill>
                                )}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3">
                                <div>
                                    <Label>Amount</Label>
                                    <div>
                                        {(() => {
                                            const currency = tx.currency || "USD";
                                            const gross =
                                                typeof tx.gross_amount === "number"
                                                    ? tx.gross_amount
                                                    : typeof tx.amount === "number"
                                                        ? tx.amount
                                                        : null;
                                            if (gross == null) return "—";
                                            return `${currency} ${gross.toFixed(2)}`;
                                        })()}
                                    </div>
                                </div>
                                <div>
                                    <Label>Refunded</Label>
                                    <div>
                                        {(() => {
                                            const currency = tx.currency || "USD";
                                            const refunded =
                                                typeof tx.refunded_total === "number"
                                                    ? tx.refunded_total
                                                    : 0;
                                            if (!refunded) return "—";
                                            return `${currency} ${refunded.toFixed(2)}`;
                                        })()}
                                    </div>
                                </div>
                                <div>
                                    <Label>Created</Label>
                                    <div>{formatDate(tx.created_at)}</div>
                                </div>
                            </div>

                            <div className="mt-3 flex justify-end">
                                <ViewTransactionDialog tx={tx} />
                            </div>
                        </div>
                    )}

                    {/* History of previous states, if any */}
                    {!!request.history?.length && (
                        <details className="rounded-md border bg-muted/40">
                            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                                Previous versions ({request.history.length})
                            </summary>
                            <div className="max-h-[260px] space-y-2 overflow-y-auto p-3 text-sm">
                                {request.history
                                    .slice()
                                    .reverse()
                                    .map((h: RefundRequestHistoryItem, idx) => (
                                        <HistoryItemRow key={idx} item={h} />
                                    ))}
                            </div>
                        </details>
                    )}

                    {/* Inline "new refund request" section */}
                    {tx && (
                        <div className="rounded-md border bg-muted/40 p-3">
                            <div className="mb-1 text-sm font-medium">
                                Submit another refund request for this payment
                            </div>
                            <div className="mb-2 text-xs text-muted-foreground">
                                Use this if you need to clarify, change, or make an additional
                                refund request related to the same transaction. This will create a
                                new refund request record.
                            </div>

                            {!isRefundableKind && (
                                <Alert className="mb-2 border-amber-500/30 bg-amber-500/10">
                                    <AlertDescription className="text-xs">
                                        This transaction type isn&apos;t eligible for new refund
                                        requests from here.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {submitError && (
                                <Alert variant="destructive" className="mb-2">
                                    <AlertDescription className="text-xs">
                                        {submitError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {submitSuccess && (
                                <Alert className="mb-2 border-emerald-500/30 bg-emerald-500/10">
                                    <AlertDescription className="text-xs">
                                        {submitSuccess}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor={`new-refund-message-${request.id}`}>
                                    Describe your new request
                                </Label>
                                <Textarea
                                    id={`new-refund-message-${request.id}`}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    rows={4}
                                    placeholder="For example: “I’d like to adjust the amount to refund $4.00 because …”"
                                    disabled={!isRefundableKind || submittingNew}
                                />
                            </div>

                            <div className="mt-3 flex justify-end">
                                <Button
                                    onClick={handleSubmitNewRequest}
                                    disabled={!isRefundableKind || submittingNew}
                                >
                                    {submittingNew && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Submit New Refund Request
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
