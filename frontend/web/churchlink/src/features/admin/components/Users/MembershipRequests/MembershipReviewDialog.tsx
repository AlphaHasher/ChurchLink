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

import {
    fmt,
    respondToMembershipRequest,
} from "@/helpers/MembershipHelper";

import { MembershipRequest, MembershipRequestHistoryItem } from "@/shared/types/MembershipRequests";

type Decision = "approve" | "deny" | null;

interface MembershipReviewDialogProps {
    request: MembershipRequest;
    onUpdated?: () => Promise<void> | void;
}

function HistoryRow({ h }: { h: MembershipRequestHistoryItem }) {
    const status = useMemo(() => {
        if (!h.resolved) return "Pending";
        return h.approved ? "Approved" : "Rejected";
    }, [h]);

    return (
        <div className="rounded-md border p-3 bg-card">
            <div className="text-sm">
                <div>
                    <span className="font-medium">Submitted:</span> {fmt(h.created_on)}
                </div>
                <div>
                    <span className="font-medium">Status:</span> {status}
                    {h.responded_to ? ` — responded ${fmt(h.responded_to)}` : ""}
                    {h.muted ? " — (Muted at time of request)" : ""}
                </div>
                <div className="mt-1 text-muted-foreground text-sm">
                    {h.message?.trim() ? h.message : "No message provided."}
                </div>
                <div className="mt-1 text-sm">
                    <span className="font-medium">Reason for Approval/Denial:</span>{" "}
                    {h.reason?.trim() ? h.reason : "—"}
                </div>
            </div>
        </div>
    );
}

export default function MembershipReviewDialog({ request, onUpdated }: MembershipReviewDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [decision, setDecision] = useState<Decision>(null);
    const [muted, setMuted] = useState<boolean>(!!request.muted);
    const [reason, setReason] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const fullName = `${request.first_name ?? ""} ${request.last_name ?? ""}`.trim() || "User";

    const open = () => {
        setIsOpen(true);
        setMuted(!!request.muted);
    };

    const close = () => {
        setIsOpen(false);
        setDecision(null);
        setMuted(!!request.muted)
        setReason("");
    };
    const handleOpenChange = (open: boolean) => {
        if (!open) close();
        setIsOpen(open);
    };

    const handleConfirm = async () => {
        if (decision == null) return;
        setSaving(true);
        const ok = await respondToMembershipRequest(request.uid, decision === "approve", muted, reason || undefined);
        setSaving(false);

        if (!ok.success) {
            window.alert(ok.msg || "Failed to update membership request.");
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
                aria-label="Review membership request"
                title="Review membership request"
            >
                <Stamp />
            </Button>

            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Review Membership — {fullName}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="rounded-md border p-3 bg-card">
                            <div className="grid gap-2 md:grid-cols-2">
                                <div>
                                    <Label>UID</Label>
                                    <div className="text-sm break-all">{request.uid}</div>
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <div className="text-sm">{request.email}</div>
                                </div>
                                <div>
                                    <Label>Submitted On</Label>
                                    <div className="text-sm">{fmt(request.created_on)}</div>

                                    <Label>Responded To</Label>
                                    <div className="text-sm">{request.responded_to?.trim() ? fmt(request.responded_to) : "Request has not yet been responded to."}</div>
                                </div>
                                <div>
                                    <Label>Status</Label>
                                    <div className="text-sm">
                                        {request.resolved
                                            ? request.approved
                                                ? "Approved"
                                                : "Rejected"
                                            : "Pending"}
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-3" />

                            <Label>Message</Label>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {request.message?.trim() ? request.message : "User did not add a message."}
                            </div>

                            <div className="mt-2">
                                <Label>Reason for Approval/Denial</Label>
                                <div className="text-sm whitespace-pre-wrap">
                                    {request.reason?.trim() ? request.reason : "—"}
                                </div>
                            </div>
                        </div>

                        {!!request.history?.length && (
                            <details className="rounded-md border bg-card">
                                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                                    History ({request.history.length})
                                </summary>
                                <div className="p-3 space-y-2 max-h-[240px] overflow-y-auto">
                                    {request.history
                                        .slice()
                                        .reverse()
                                        .map((h, idx) => (
                                            <HistoryRow key={idx} h={h} />
                                        ))}
                                </div>
                            </details>
                        )}

                        <div className="rounded-md border p-3 bg-card">
                            <div className="font-medium mb-1">Decision</div>
                            <div className="text-sm text-muted-foreground mb-2">
                                Choose to approve or deny this membership request.
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant={decision === "approve" ? "default" : "outline"}
                                    className={decision === "approve"
                                        ? "!bg-primary !text-primary-foreground"
                                        : "hover:bg-accent hover:text-green-600"
                                    }
                                    onClick={() => setDecision("approve")}
                                >
                                    Approve
                                </Button>
                                <Button
                                    type="button"
                                    variant={decision === "deny" ? "destructive" : "outline"}
                                    className={decision === "deny"
                                        ? "!bg-destructive !text-destructive-foreground"
                                        : "bg-background text-foreground hover:bg-accent hover:text-red-600"
                                    }
                                    onClick={() => setDecision("deny")}
                                >
                                    Deny
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-md border p-3 bg-card">
                            <div className="font-medium mb-1">Reason for Approval/Denial (optional)</div>
                            <div className="text-sm text-muted-foreground mb-2">
                                Add a short note explaining your decision (visible in the request history).
                            </div>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                className="w-full border rounded px-3 py-2 text-sm"
                                placeholder="Type reason…"
                            />
                        </div>

                        <div className="rounded-md border p-3 bg-card">
                            <div className="font-medium mb-1">Mute (optional)</div>
                            <div className="text-sm text-muted-foreground mb-2">
                                Muting prevents this user from submitting additional membership requests (useful if
                                they’re spamming after a rejection). This setting is independent of the decision.
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={muted}
                                    onChange={(e) => setMuted(e.target.checked)}
                                />
                                Mute this user from future membership requests
                            </label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={close} disabled={saving}>
                            Close
                        </Button>
                        <Button onClick={handleConfirm} disabled={saving || decision === null}>
                            {saving ? "Updating…" : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
