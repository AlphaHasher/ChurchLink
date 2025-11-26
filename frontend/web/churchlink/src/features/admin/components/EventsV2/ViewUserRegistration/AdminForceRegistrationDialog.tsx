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
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2, UserPlus2, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";

import type { AdminEventInstance, PersonDict, AdminForceChange } from "@/shared/types/Event";
import { adminForceRegister } from "@/helpers/EventRegistrationHelper";

type Props = {
    instance: AdminEventInstance;
    userId: string;
    personId: "SELF" | string;
    personDict?: PersonDict;
    onDone?: () => void; // optional — will dispatch a global event if not provided
    buttonVariant?: "icon" | "default"; // used if you ever want a non-icon button
};

export default function AdminForceRegistrationDialog({
    instance,
    userId,
    personId,
    personDict,
    onDone,
}: Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [price, setPrice] = useState<string>("");

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

    const doRegister = async () => {
        setSaving(true);
        try {
            const numeric = price.trim() === "" ? null : Number(price);
            if (price.trim() !== "" && (isNaN(numeric as number) || (numeric as number) < 0)) {
                toast.error("Invalid price. Leave blank for free; otherwise enter a non-negative number.");
                setSaving(false);
                return;
            }

            const payload: AdminForceChange = {
                event_instance_id: instance.id,
                user_id: userId,
                registrant_id: personId,
                // omit price for free; any number > 0 means "door"
                ...(numeric && numeric > 0 ? { price: Number(numeric.toFixed ? numeric.toFixed(2) : numeric) } : {}),
            };

            const res = await adminForceRegister(payload);
            if (!res?.success) {
                toast.error(res?.msg || "Force registration failed.");
                setSaving(false);
                return;
            }

            toast.success(res?.msg || "Force registration succeeded.");
            setOpen(false);

            if (onDone) onDone();
            else window.dispatchEvent(new CustomEvent("admin:registration:changed"));
        } catch (e: any) {
            toast.error(e?.message || "Force registration failed.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                title="Force register"
                aria-label="Force register"
                onClick={() => setOpen(true)}
            >
                <UserPlus2 className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
                <DialogContent className="max-w-xl w-full">
                    <DialogHeader>
                        <DialogTitle>Force Register</DialogTitle>
                        <DialogDescription>
                            Add <b>{personName}</b> to <b>{eventTitle}</b> on{" "}
                            <b>{new Date(instance.date).toLocaleString()}</b>, bypassing capacity and validation checks.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">Heads up</div>
                                <ul className="list-disc ml-5 space-y-1">
                                    <li>This ignores capacity and usual validation.</li>
                                    <li>Leave price blank or 0 to register as <b>Free</b>.</li>
                                    <li>Enter a price &gt; 0 to mark as <b>Pay at Door</b> (unpaid).</li>
                                </ul>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="force-price">Price (optional)</Label>
                            <Input
                                id="force-price"
                                type="number"
                                inputMode="decimal"
                                placeholder="Leave blank for free; > 0 for at-door"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                min="0"
                                step="0.01"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
                        <Button onClick={doRegister} disabled={saving}>
                            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>) : "Force Register"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
