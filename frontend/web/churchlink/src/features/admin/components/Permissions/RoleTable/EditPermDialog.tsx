import { useState, useEffect } from "react";
import { AccountPermissions } from "@/shared/types/AccountPermissions";
import { PermissionTogglers } from "./PermissionTogglers";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Edit, Loader2 } from "lucide-react";

import { updateRole } from "@/helpers/PermissionsHelper";

interface EditPermDialogProps {
    permissions: AccountPermissions;
    onSave: () => Promise<void>;
}

// Allows user to edit an already existing permission
export function EditPermDialog({
    permissions: initialPermissions,
    onSave: onSave
}: EditPermDialogProps) {
    const [permissions, setPermissions] = useState<AccountPermissions>(initialPermissions);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Reset the permissions when dialog is opened
        setPermissions(initialPermissions);
    }, [initialPermissions]);

    const handleDialogClose = () => {
        setPermissions(initialPermissions); // Reset to initial permissions
        setIsOpen(false); // Close the dialog
    };

    // Handle Save Button
    const handleSaveChanges = async () => {
        setSaving(true);
        const res = await updateRole(permissions)
        if (res?.success) {
            await onSave()
            handleDialogClose()
        }
        else {
            alert(`Error!: ${res.msg}`)
        }
        setSaving(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open); // Control dialog open state
            if (!open) {
                handleDialogClose(); // Close and reset when the dialog is closed
            }
        }}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-white text-black border shadow-sm hover:bg-blue-600"
                    onClick={() => setIsOpen(true)} // Open the dialog when the button is clicked
                >
                    <Edit />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Permission Role</DialogTitle>
                    <div className="pt-6">
                        <DialogDescription>
                            Make your desired edits to the permissions role. You can only modify permissions that your account already has. Click "Save changes" when you are done.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Permissions Name</Label>
                        <small className="text-gray-500 text-xs">A unique name that you will use to apply this permission role to users</small>
                        <Input
                            id="name"
                            value={permissions.name}
                            onChange={(e) => setPermissions({ ...permissions, name: e.target.value })}
                        />
                    </div>

                    {/* Pass permissions to PermissionTogglers */}
                    <PermissionTogglers permissions={permissions} onChange={setPermissions} />
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleDialogClose} disabled={saving}>Cancel</Button>
                    <Button type="button" onClick={handleSaveChanges} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                Saving...
                            </>
                        ) : (
                            "Save changes"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
