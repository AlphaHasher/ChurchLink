import { useState } from "react"
import { AccountPermissions, PermMask } from "@/shared/types/AccountPermissions"
import { PermissionTogglers } from "@/features/admin/components/Permissions/RoleTable/PermissionTogglers"
import { Button } from "@/shared/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Loader2 } from "lucide-react"

import { createRole } from "@/helpers/PermissionsHelper"
import { getMyPermissions } from "@/helpers/UserHelper"

interface CreatePermDialogProps {
    onSave: () => Promise<void>;
}

//Dialog to allow the user to create a new permission set
export function CreatePermDialog({ onSave }: CreatePermDialogProps) {
    //Since a new PermissionSet is being created, initialize a fresh permission set to start blank
    const initialPermissions: AccountPermissions = {
        _id: "",
        name: "",
        admin: false,
        permissions_management: false,
        event_editing: false,
        event_management: false,
        media_management: false,
    }

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
        setSaving(true)
        const res = await createRole(permissions)
        if (res?.success) {
            await onSave()
            handleDialogClose()
        }
        else {
            alert(`Error!: ${res.msg}`)
        }
        setSaving(false)
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
                className="!bg-blue-500 text-white border border-blue-600 shadow-sm hover:bg-blue-600"
                onClick={async () => {
                    setCheckingPerms(true)
                    try {
                        const result = await getMyPermissions()

                        if (result?.success) {
                            if (result?.perms.admin || result?.perms.permissions_management) {
                                setEditorPerms(result?.perms as PermMask)
                                setIsOpen(true)
                            }
                            else {
                                alert("You can only create new roles if you have the Admin or Permissions Management roles!")
                            }
                        }
                        else {
                            alert(result?.msg || "You don't have permission to create new roles.")
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
                    "Create New Role"
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleDialogCloseChange}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New Permission Role</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription>
                                Define your new permission role. You can only assign permissions that your account already has. Click "Save changes" when you are done.
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
