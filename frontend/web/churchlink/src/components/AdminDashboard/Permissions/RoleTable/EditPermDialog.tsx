import { useState, useEffect } from "react";
import { AccountPermissions } from "@/types/AccountPermissions";
import { PermissionTogglers } from "./PermissionTogglers";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit } from "lucide-react";

interface EditPermDialogProps {
    permissions: AccountPermissions;
}

// Allows user to edit an already existing permission
export function EditPermDialog({
    permissions: initialPermissions,
}: EditPermDialogProps) {
    const [permissions, setPermissions] = useState<AccountPermissions>(initialPermissions);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Reset the permissions when dialog is opened
        setPermissions(initialPermissions);
    }, [initialPermissions]);

    const handleDialogClose = () => {
        setPermissions(initialPermissions); // Reset to initial permissions
        setIsOpen(false); // Close the dialog
    };

    const handleSaveChanges = () => {
        handleDialogClose(); // Close the dialog after saving
    };

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
                    <Button type="button" onClick={handleDialogClose}>Cancel</Button>
                    <Button type="button" onClick={handleSaveChanges}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
