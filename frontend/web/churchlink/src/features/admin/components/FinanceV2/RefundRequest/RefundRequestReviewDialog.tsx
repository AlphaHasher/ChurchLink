// RefundRequestReviewDialog.tsx
// Admin dialog for reviewing / responding to a refund request.

import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { Separator } from "@/shared/components/ui/separator";
import { Label } from "@/shared/components/ui/label";
import { Stamp } from "lucide-react";

import { fmt } from "@/helpers/MembershipHelper";
import {
    RefundRequestWithTransaction,
    RefundRequestHistoryItem,
} from "@/shared/types/RefundRequest";
import { adminRespondToRefundRequest } from "@/helpers/RefundRequestHelper";

type Decision = "resolved" | "unresolved" | null;

interface RefundRequestReviewDialogProps {
    request: RefundRequestWithTransaction;
    onUpdated?: () => Promise<void> | void;
}

function historyStatus(h: RefundRequestHistoryItem): string {
    if (!h.responded) return "Pending";
    return h.resolved ? "Resolved" : "Unresolved";
}

function HistoryRow({ h }: { h: RefundRequestHistoryItem }) {
    const status = useMemo(() => historyStatus(h), [h]);

    return (
        <div className="rounded-md border bg-card p-3">
            <div className="text-sm">
                <div>
                    <span className="font-medium">Submitted:</span> {fmt(h.created_on)}
                </div>
                <div>
                    <span className="font-medium">Status:</span> {status}
                    {h.responded_to ? ` — responded ${fmt(h.responded_to)}` : ""}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {h.message?.trim() ? h.message : "No message provided."}
                </div>
                <div className="mt-1 text-sm">
                    <span className="font-medium">Admin Reason:</span>{" "}
                    {h.reason?.trim() ? h.reason : "—"}
                </div>
            </div>
        </div>
    );
}

export default function RefundRequestReviewDialog({
    request,
    onUpdated,
}: RefundRequestReviewDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [decision, setDecision] = useState<Decision>(null);
    const [reason, setReason] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const open = () => {
        setIsOpen(true);
    };

    const close = () => {
        setIsOpen(false);
        setDecision(null);
        setReason("");
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) close();
        setIsOpen(open);
    };

    const statusLabel = useMemo(() => {
        if (!request.responded) return "Pending";
        return request.resolved ? "Resolved" : "Unresolved";
    }, [request]);

    const handleConfirm = async () => {
        if (decision == null) return;
        setSaving(true);

        const payload = {
            id: request.id,
            responded: true,
            resolved: decision === "resolved",
            reason: reason || null,
        };

        const res = await adminRespondToRefundRequest(payload);
        setSaving(false);

        if (!res.success) {
            window.alert(res.msg || "Failed to update refund request.");
            return;
        }

        close();
        await onUpdated?.();
    };

    return (
        <>
            <Button
                variant="ghost"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={open}
                aria-label="Review refund request"
                title="Review refund request"
            >
                <Stamp />
            </Button>

            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                {/* high z so header doesn't clip this */}
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto z-[999]">
                    <DialogHeader>
                        <DialogTitle>
                            Review Refund Request — {request.txn_kind.toUpperCase()}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        {/* Basic details */}
                        <div className="rounded-md border bg-card p-3">
                            <div className="grid gap-2 md:grid-cols-2">
                                <div>
                                    <Label>UID</Label>
                                    <div className="break-all text-sm">{request.uid}</div>
                                </div>
                                <div>
                                    <Label>Transaction Kind</Label>
                                    <div className="text-sm">
                                        {request.txn_kind === "event"
                                            ? "Event transaction"
                                            : request.txn_kind === "form"
                                                ? "Form payment"
                                                : request.txn_kind}
                                    </div>
                                </div>
                                <div>
                                    <Label>Transaction ID</Label>
                                    <div className="break-all text-sm">
                                        {request.txn_id || "—"}
                                    </div>
                                </div>
                                <div>
                                    <Label>Submitted On</Label>
                                    <div className="text-sm">
                                        {fmt(request.created_on)}
                                    </div>

                                    <Label>Responded To</Label>
                                    <div className="text-sm">
                                        {request.responded_to?.trim()
                                            ? fmt(request.responded_to)
                                            : "Request has not yet been responded to."}
                                    </div>
                                </div>
                                <div>
                                    <Label>Status</Label>
                                    <div className="text-sm">{statusLabel}</div>
                                </div>
                            </div>

                            <Separator className="my-3" />

                            <Label>User Message</Label>
                            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {request.message?.trim()
                                    ? request.message
                                    : "User did not add a message."}
                            </div>

                            <div className="mt-2">
                                <Label>Last Admin Reason</Label>
                                <div className="whitespace-pre-wrap text-sm">
                                    {request.reason?.trim() ? request.reason : "—"}
                                </div>
                            </div>
                        </div>

                        {/* History */}
                        {!!request.history?.length && (
                            <details className="rounded-md border bg-card">
                                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                                    History ({request.history.length})
                                </summary>
                                <div className="max-h-[240px] space-y-2 overflow-y-auto p-3">
                                    {request.history
                                        .slice()
                                        .reverse()
                                        .map((h, idx) => (
                                            <HistoryRow key={idx} h={h} />
                                        ))}
                                </div>
                            </details>
                        )}

                        {/* Decision section */}
                        <div className="rounded-md border bg-card p-3">
                            <div className="mb-1 font-medium">Admin Decision</div>
                            <div className="mb-2 text-sm text-muted-foreground">
                                Mark this refund request as resolved (you consider it fully
                                dealt with), or unresolved (you responded but need more info or
                                follow-up).
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant={decision === "resolved" ? "default" : "outline"}
                                    className={
                                        decision === "resolved"
                                            ? "!bg-primary !text-primary-foreground"
                                            : "hover:bg-accent hover:text-green-600"
                                    }
                                    onClick={() => setDecision("resolved")}
                                >
                                    Mark as Resolved
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        decision === "unresolved"
                                            ? "destructive"
                                            : "outline"
                                    }
                                    className={
                                        decision === "unresolved"
                                            ? "!bg-destructive !text-destructive-foreground"
                                            : "bg-background text-foreground hover:bg-accent hover:text-red-600"
                                    }
                                    onClick={() => setDecision("unresolved")}
                                >
                                    Mark as Unresolved
                                </Button>
                            </div>
                        </div>

                        {/* Reason input */}
                        <div className="rounded-md border bg-card p-3">
                            <div className="mb-1 font-medium">Admin Reason (optional)</div>
                            <div className="mb-2 text-sm text-muted-foreground">
                                Add a note explaining your current decision. This is stored in
                                the refund request history.
                            </div>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                className="w-full rounded border px-3 py-2 text-sm"
                                placeholder="Explain why this request is resolved / unresolved…"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={close} disabled={saving}>
                            Close
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={saving || decision === null}
                        >
                            {saving ? "Updating…" : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
