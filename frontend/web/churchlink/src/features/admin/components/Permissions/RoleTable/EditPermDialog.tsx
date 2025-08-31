import { useState } from "react";
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
} from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Edit, Loader2 } from "lucide-react";

import { updateRole } from "@/helpers/PermissionsHelper";

import { getMyPermissions } from "@/helpers/UserHelper";

import { PermMask } from "@/shared/types/AccountPermissions";

interface EditPermDialogProps {
    permissions: AccountPermissions;
    onSave: () => Promise<void>;
}

//Dialog to allow the user to edit a permission set
export function EditPermDialog({ onSave, permissions: initialPermissions }: EditPermDialogProps) {



    const initialEditorPermissions: PermMask = {
        admin: false,
        permissions_management: false,
        event_editing: false,
        event_management: false,
        media_management: false,
    }


    // State to hold current permissions
    const [permissions, setPermissions] = useState<AccountPermissions>(initialPermissions)

    // State to hold editor permissions
    const [editorPermissions, setEditorPerms] = useState<PermMask>(initialEditorPermissions)

    // Track whether the dialog is open or closed
    const [isOpen, setIsOpen] = useState(false)

    // Track saving state
    const [saving, setSaving] = useState(false)

    // Track permission checking state
    const [checkingPerms, setCheckingPerms] = useState(false)

    // Reset permissions when dialog is closed
    const handleDialogClose = () => {
        setPermissions(initialPermissions) // Reset to initial permissions
        setEditorPerms(initialEditorPermissions)
        setIsOpen(false) // Close the dialog
    }

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

    // Handle when the dialog is closed, either by clicking the X or the backdrop
    const handleDialogCloseChange = (open: boolean) => {
        if (!open) {
            handleDialogClose() // Reset and close when dialog is closed
        }
    }

    return (
        <>
            {/* Physical Manifestation of the Dialog, the Button that opens it */}
            <Button
                variant="outline"
                className="!bg-white text-black border shadow-sm hover:bg-blue-600"
                onClick={async () => {
                    setCheckingPerms(true)
                    try {
                        const result = await getMyPermissions()

                        if (result?.success) {
                            if (result?.perms.admin || result?.perms.permissions_management) {
                                if (permissions.admin && !result?.perms.admin) {
                                    alert("Non-Admins cannot edit roles with the Administrator permission!")
                                }
                                else if (permissions.permissions_management && !result?.perms.admin) {
                                    alert("You can't edit roles with the \"Permissions Management\" without having Administrator privilleges!")
                                }
                                else {
                                    setEditorPerms(result?.perms as PermMask)
                                    setIsOpen(true)
                                }

                            }
                            else {
                                alert("You can only edit roles if you have the Admin or Permissions Management roles!")
                            }
                        }
                        else {
                            alert(result?.msg || "You don't have permission to edit roles.")
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
                    <Edit />
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleDialogCloseChange}>
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
                        {/* Name Input Section */}
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
                        <PermissionTogglers permissions={permissions} onChange={setPermissions} editor_permissions={editorPermissions} />
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
        </>
    )
}
