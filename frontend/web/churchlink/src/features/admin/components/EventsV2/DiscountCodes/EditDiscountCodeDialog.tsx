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
import type { DiscountCode, DiscountCodeUpdate } from "@/shared/types/Event";
import { updateDiscountCode } from "@/helpers/EventManagementHelper";
import DiscountCodeInputs from "@/features/admin/components/EventsV2/DiscountCodes/DiscountCodeInputs";

type Props = { code: DiscountCode; onSaved?: () => void };

export default function EditDiscountCodeDialog({ code, onSaved }: Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<DiscountCodeUpdate | null>(null);

    useEffect(() => {
        if (!open) return;
        const base: DiscountCodeUpdate = {
            name: code.name,
            description: code.description ?? null,
            code: code.code,
            is_percent: code.is_percent,
            discount: code.discount,
            max_uses: code.max_uses ?? null,
            active: code.active,
        };
        setDraft(base);
    }, [open, code]);

    const handleSave = async () => {
        if (!draft) return;
        setSaving(true);
        try {
            const payload: DiscountCodeUpdate = {
                ...draft,
                description: draft.description && draft.description.trim() !== "" ? draft.description : null,
            };
            const res = await updateDiscountCode(code.id, payload);
            if (!res?.success) {
                alert(res?.msg || "Failed to save changes.");
                return;
            }
            setOpen(false);
            onSaved?.();
        } catch (err) {
            console.error("Edit discount code failed", err);
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
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Edit Discount Code</DialogTitle>
                        <DialogDescription>Update the fields below and save your changes.</DialogDescription>
                    </DialogHeader>

                    <DiscountCodeInputs value={draft ?? undefined} disabled={saving} onChange={(d) => setDraft(d)} />

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
