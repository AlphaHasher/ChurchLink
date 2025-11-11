import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/shared/components/ui/Dialog";
import EventUpdateInputsV2 from "./EventUpdateInputsV2";
import { createAdminPanelEvent } from "@/helpers/EventManagementHelper";
import type { EventUpdate } from "@/shared/types/Event";
import type { Ministry } from "@/shared/types/Ministry";

type CreateEventDialogV2Props = {
    allMinistries: Ministry[];
    preferredLangCode?: string;
    onCreated?: () => void;
};

export default function CreateEventDialogV2({
    allMinistries,
    preferredLangCode,
    onCreated,
}: CreateEventDialogV2Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<EventUpdate | null>(null);

    const handleSave = async () => {
        if (!draft) return;

        // Guard: paid events must specify at least one payment option
        if ((draft.price ?? 0) > 0 && (!draft.payment_options || draft.payment_options.length === 0)) {
            alert("Paid events must include at least one payment option (e.g., PayPal, Door).");
            return;
        }

        setSaving(true);
        try {
            const payload: EventUpdate = {
                ...draft,
                localizations:
                    draft.localizations instanceof Map
                        ? Object.fromEntries(draft.localizations.entries())
                        : (draft.localizations as any),
            };

            const res = await createAdminPanelEvent(payload);

            // If backend explicitly indicates failure, keep dialog open and show the message
            if (res && typeof res === "object" && "success" in res && (res as any).success === false) {
                const msg = (res as any).msg || "Failed to create event.";
                alert(msg);
                return;
            }

            // Otherwise treat as success: close and notify parent
            setOpen(false);
            onCreated?.();
        } catch (err) {
            console.error("Create event failed", err);
            alert("Failed to create event.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>Create Event</Button>

            <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
                <DialogContent className="sm:max-w-[90vw] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New Event</DialogTitle>
                        <DialogDescription>
                            Fill in the details below, then save to create the event.
                        </DialogDescription>
                    </DialogHeader>

                    <EventUpdateInputsV2
                        allMinistries={allMinistries}
                        preferredLangCode={preferredLangCode}
                        disabled={saving}
                        onChange={(d) => setDraft(d)}
                    />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
