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
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Trash2 } from "lucide-react";
import type { ReadAdminPanelEvent } from "@/shared/types/Event";
import { deleteAdminPanelEvent } from "@/helpers/EventManagementHelper";

type DeleteEventDialogV2Props = {
    event: ReadAdminPanelEvent;
    onDeleted?: () => void;
};

export default function DeleteEventDialogV2({ event, onDeleted }: DeleteEventDialogV2Props) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    useEffect(() => {
        if (!open) setConfirmText("");
    }, [open]);

    const handleDelete = async () => {
        if (confirmText !== "Confirm") return;
        const id = (event as any).id;
        if (!id) {
            alert("Missing event id for delete.");
            return;
        }

        setDeleting(true);
        try {
            const res = await deleteAdminPanelEvent(id);
            if (res && typeof res === "object" && "success" in res && (res as any).success === false) {
                const msg = (res as any).msg || "Failed to delete event.";
                alert(msg);
                return;
            }

            setOpen(false);
            onDeleted?.();
        } catch (err) {
            console.error("Delete event failed", err);
            alert("Failed to delete event.");
        } finally {
            setDeleting(false);
        }
    };

    const title = (event as any).default_title || "this event";
    const disabled = deleting || confirmText !== "Confirm";

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                title="Delete"
                onClick={() => setOpen(true)}
                className="text-red-600 hover:text-red-700"
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(v) => { if (!deleting) setOpen(v); }}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Delete Event</DialogTitle>
                        <DialogDescription>
                            Are you sure that you want to delete <span className="font-medium">{title}</span>?
                            <br />
                            <span className="text-red-600 font-medium">
                                Deleting this event will also delete every instance of this event.
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <Label htmlFor="deleteConfirm">Type <span className="font-semibold">Confirm</span> to proceed</Label>
                        <Input
                            id="deleteConfirm"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Confirm"
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
