import { useState, useEffect } from "react";
import { AccountPermissions } from "@/shared/types/AccountPermissions";
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
import { Trash, Loader2 } from "lucide-react";

import { deleteRole } from "@/helpers/PermissionsHelper";
import { getMyPermissions } from "@/helpers/UserHelper";

interface DeletePermDialogProps {
    permissions: AccountPermissions;
    onSave: () => Promise<void>;
}

//Dialog that allows the user to delete an existing permission
export function DeletePermDialog({
    permissions: initialPermissions,
    onSave: onSave
}: DeletePermDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [userInput, setUserInput] = useState(""); // Track user input
    const [isDeleteEnabled, setIsDeleteEnabled] = useState(false); // Enable delete only when the input matches the name
    const [isDeleting, setIsDeleting] = useState(false);
    // Track permission checking state
    const [checkingPerms, setCheckingPerms] = useState(false)

    useEffect(() => {
        // Reset user input and delete enabled status when dialog is opened
        setUserInput("");
        setIsDeleteEnabled(false);
    }, [isOpen]);

    const handleDialogClose = () => {
        setIsOpen(false);
        setUserInput(""); // Reset the input when the dialog closes
    };

    // Handle Delete button
    const handleDelete = async () => {
        if (userInput === initialPermissions.name) {
            setIsDeleting(true);
            const res = await deleteRole(initialPermissions)
            if (res?.success) {
                await onSave()
                handleDialogClose()
            }
            else {
                alert(`Error!: ${res.msg}`)
            }
            setIsDeleting(false);
        } else {
            alert("Names do not match. Please try again.");
        }
    };

    // Enable the delete button when the user input matches the permissions name
    useEffect(() => {
        setIsDeleteEnabled(userInput === initialPermissions.name);
    }, [userInput, initialPermissions.name]);

    return (
        <>
            {/* Physical Manifestation of the Dialog, the Button that opens it */}
            <Button
                variant="outline"
                className="!bg-background text-destructive border shadow-sm !hover:bg-destructive"
                onClick={async () => {
                    setCheckingPerms(true)
                    try {
                        const result = await getMyPermissions()

                        if (result?.success) {
                            if (result?.perms.admin || result?.perms.permissions_management) {

                                if (!result?.perms.admin && initialPermissions.permissions_management) {
                                    alert("Only Administrators may delete roles with permissions management!");
                                }
                                else {
                                    const keysToCheck = Object.keys(initialPermissions).filter(
                                        (key) => key !== "_id" && key !== "name"
                                    ) as (keyof AccountPermissions)[];

                                    const conflict = keysToCheck.some(
                                        (key) => initialPermissions[key] && !result.perms[key]
                                    );

                                    if (conflict) {
                                        alert("You cannot delete a role that has a permission you don\'t have access to!");
                                    } else {
                                        setIsOpen(true);
                                    }
                                }

                            }
                            else {
                                alert("You can only delete roles if you have the Admin or Permissions Management permissions!")
                            }
                        }
                        else {
                            alert(result?.msg || "You don't have permission to delete roles.")
                        }
                    } catch (err) {
                        alert("An error occurred while checking your permissions.")
                        console.error(err)
                    }
                    setCheckingPerms(false)
                }}
                disabled={checkingPerms}
            >
                {checkingPerms ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    </>
                ) : (
                    <Trash />
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Delete Permission Role</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription>
                                Are you absolutely sure you want to delete the permission role "
                                {initialPermissions.name}"? This action cannot be undone. Please
                                type the name "{initialPermissions.name}" to confirm the deletion.
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Deletion Confirmation</Label>
                            <small className="text-gray-500 text-xs">
                                Type the name "{initialPermissions.name}" to confirm that you
                                want to delete this permission role.
                            </small>
                            <Input
                                id="name"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleDialogClose} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="!bg-red-30"
                            onClick={handleDelete}
                            disabled={!isDeleteEnabled || isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                    Deleting...
                                </>
                            ) : (
                                "Confirm Delete"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
