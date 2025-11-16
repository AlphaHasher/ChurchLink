import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/shared/components/ui/Dialog";
import { Pencil } from "lucide-react";
import EventUpdateInputsV2 from "./EventUpdateInputsV2";
import type { EventUpdate, ReadAdminPanelEvent } from "@/shared/types/Event";
import type { Ministry } from "@/shared/types/Ministry";
import { editAdminPanelEvent } from "@/helpers/EventManagementHelper";

type EditEventDialogV2Props = {
    event: ReadAdminPanelEvent;
    allMinistries: Ministry[];
    preferredLangCode?: string;
    onEdited?: () => void;
};

export default function EditEventDialogV2({
    event,
    allMinistries,
    preferredLangCode,
    onEdited,
}: EditEventDialogV2Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<EventUpdate | null>(null);

    useEffect(() => {
        if (!open) return;
        const base: any = {
            ...event,
            localizations: event.localizations ?? {},
        };
        setDraft(base as EventUpdate);
    }, [open, event]);

    const handleSave = async () => {
        if (!draft) return;

        // Guard: paid events must specify at least one payment option
        if ((draft.price ?? 0) > 0 && (!draft.payment_options || draft.payment_options.length === 0)) {
            alert("Paid events must include at least one payment option (e.g., PayPal, Door).");
            return;
        }

        setSaving(true);
        try {
            // Ensure localizations is a plain object before sending (helper also guards, but belt/suspenders)
            // Had issues getting localizations to save due to some form of fast api problem before
            // This seemed to help fix it
            const payload: EventUpdate = {
                ...draft,
                localizations:
                    draft.localizations instanceof Map
                        ? Object.fromEntries(draft.localizations.entries())
                        : (draft.localizations as any),
            };

            const id = (event as any).id;
            if (!id) {
                alert("Missing event id for update.");
                return;
            }

            const res = await editAdminPanelEvent(payload, id);
            if (res && typeof res === "object" && "success" in res && (res as any).success === false) {
                const msg = (res as any).msg || "Failed to save changes.";
                alert(msg);
                return;
            }

            setOpen(false);
            onEdited?.();
        } catch (err) {
            console.error("Edit event failed", err);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Edit">
                <Pencil className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
                <DialogContent className="sm:max-w-[90vw] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Event</DialogTitle>
                        <DialogDescription>Update the fields below and save your changes.</DialogDescription>
                    </DialogHeader>

                    <EventUpdateInputsV2
                        allMinistries={allMinistries}
                        preferredLangCode={preferredLangCode}
                        disabled={saving}
                        initial={event as any}
                        value={draft ?? undefined}
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