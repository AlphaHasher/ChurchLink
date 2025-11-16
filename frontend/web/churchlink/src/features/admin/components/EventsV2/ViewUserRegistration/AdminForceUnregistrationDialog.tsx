import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { Loader2, UserMinus2, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";

import type { AdminEventInstance, PersonDict, AdminForceChange } from "@/shared/types/Event";
import { adminForceUnregister } from "@/helpers/EventRegistrationHelper";

type Props = {
    instance: AdminEventInstance;
    userId: string;
    personId: "SELF" | string;
    personDict?: PersonDict;
    onDone?: () => void;
};

export default function AdminForceUnregistrationDialog({
    instance,
    userId,
    personId,
    personDict,
    onDone,
}: Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const personName = useMemo(() => {
        const key = personId === "SELF" ? "SELF" : personId;
        const p = personDict?.[key];
        const first = p?.first_name ?? "";
        const last = p?.last_name ?? "";
        const name = (first + " " + last).trim();
        // Fallbacks: prefer plain "Account Holder" (no SELF tag) if we truly don't have a name
        return name || (personId === "SELF" ? "Account Holder" : personId);
    }, [personId, personDict]);

    const eventTitle = instance?.default_title || "Event";

    const close = () => {
        if (!saving) setOpen(false);
    };

    const doUnregister = async () => {
        setSaving(true);
        try {
            const payload: AdminForceChange = {
                event_instance_id: instance.id,
                user_id: userId,
                registrant_id: personId,
            };

            const res = await adminForceUnregister(payload);
            if (!res?.success) {
                toast.error(res?.msg || "Force unregistration failed.");
                setSaving(false);
                return;
            }

            toast.success(res?.msg || "Force unregistration succeeded.");
            setOpen(false);

            if (onDone) onDone();
            else window.dispatchEvent(new CustomEvent("admin:registration:changed"));
        } catch (e: any) {
            toast.error(e?.message || "Force unregistration failed.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                title="Force unregister"
                aria-label="Force unregister"
                onClick={() => setOpen(true)}
            >
                <UserMinus2 className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
                <DialogContent className="max-w-xl w-full">
                    <DialogHeader>
                        <DialogTitle>Force Unregister</DialogTitle>
                        <DialogDescription>
                            Remove <b>{personName}</b> from <b>{eventTitle}</b> on{" "}
                            <b>{new Date(instance.date).toLocaleString()}</b>, bypassing capacity/validation checks.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">Important</div>
                                <ul className="list-disc ml-5 space-y-1">
                                    <li>If this person paid via <b>PayPal</b>, a refund will be issued automatically.</li>
                                    <li>At-door (unpaid) and free registrations are just removed.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
                        <Button onClick={doUnregister} disabled={saving}>
                            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>) : "Force Unregister"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
