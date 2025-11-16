import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/shared/components/ui/Dialog";
import type { DiscountCodeUpdate } from "@/shared/types/Event";
import { createDiscountCode } from "@/helpers/EventManagementHelper";
import DiscountCodeInputs from "@/features/admin/components/EventsV2/DiscountCodes/DiscountCodeInputs";

type Props = { onCreated?: () => void };

export default function CreateDiscountCodeDialog({ onCreated }: Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<DiscountCodeUpdate>({
        name: "",
        description: null,
        code: "",
        is_percent: false,
        discount: 0,
        max_uses: null,
        active: true,
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: DiscountCodeUpdate = {
                ...draft,
                description: draft.description && draft.description.trim() !== "" ? draft.description : null,
            };
            const res = await createDiscountCode(payload);
            if (!res?.success) {
                alert(res?.msg || "Failed to create discount code.");
                return;
            }
            setOpen(false);
            onCreated?.();
        } catch (err) {
            console.error("Create discount code failed", err);
            alert("Failed to create discount code.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>Create Discount Code</Button>

            <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>New Discount Code</DialogTitle>
                        <DialogDescription>Fill in the details below, then save to create the code.</DialogDescription>
                    </DialogHeader>

                    <DiscountCodeInputs value={draft} disabled={saving} onChange={setDraft} />

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
