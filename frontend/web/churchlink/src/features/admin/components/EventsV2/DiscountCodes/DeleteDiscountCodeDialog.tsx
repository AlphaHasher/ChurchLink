import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import type { DiscountCode } from "@/shared/types/Event";
import { deleteDiscountCode } from "@/helpers/EventManagementHelper";

type Props = {
    code: DiscountCode;
    onDeleted?: () => void;
};

export default function DeleteDiscountCodeDialog({ code, onDeleted }: Props) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    const normalizedTarget = useMemo(
        () => (code.code || "").trim().toLowerCase(),
        [code.code]
    );
    const isMatch = confirmText.trim().toLowerCase() === normalizedTarget;
    const disabled = deleting || !isMatch;

    useEffect(() => {
        if (!open) setConfirmText("");
    }, [open]);

    const handleDelete = async () => {
        if (!isMatch) return;
        setDeleting(true);
        try {
            const res = await deleteDiscountCode(code.id);
            if (!res?.success) {
                alert(res?.msg || "Failed to delete discount code.");
                return;
            }
            toast.success(`${res.msg ?? "Deleted."}`);
            setOpen(false);
            onDeleted?.();
        } catch (err) {
            console.error("Delete discount code failed", err);
            alert("Failed to delete discount code.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                title="Delete discount code"
                onClick={() => setOpen(true)}
                className="text-red-600 hover:text-red-700"
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(v) => { if (!deleting) setOpen(v); }}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Delete Discount Code</DialogTitle>
                        <DialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium">{code.code}</span> and remove it
                            from all events that reference it.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <Label htmlFor="deleteConfirm">
                            Type <span className="font-semibold">{code.code}</span> to confirm
                        </Label>
                        <Input
                            id="deleteConfirm"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={code.code}
                            disabled={deleting}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !disabled) handleDelete();
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            This action is irreversible.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={disabled}
                            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                            {deleting ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
