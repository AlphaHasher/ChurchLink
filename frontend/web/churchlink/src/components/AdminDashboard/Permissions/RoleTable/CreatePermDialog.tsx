import { useState } from "react"
import { AccountPermissions } from "@/types/AccountPermissions"
import { PermissionTogglers } from "@/components/AdminDashboard/Permissions/RoleTable/PermissionTogglers"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/Dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createRole } from "@/helpers/PermissionsHelper"

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
        finance: false,
        website_management: false,
        event_management: false,
        page_management: false,
        media_management: false,
    }

    // State to hold current permissions
    const [permissions, setPermissions] = useState<AccountPermissions>(initialPermissions)

    // Track whether the dialog is open or closed
    const [isOpen, setIsOpen] = useState(false)

    // Reset permissions when dialog is closed
    const handleDialogClose = () => {
        setPermissions(initialPermissions) // Reset to initial permissions
        setIsOpen(false) // Close the dialog
    }

    // Handle Save Button
    const handleSaveChanges = async () => {
        const res = await createRole(permissions)
        if (res?.success) {
            await onSave()
            handleDialogClose()
        }
        else {
            alert(`Error!: ${res.msg}`)
        }
    }

    // Handle when the dialog is closed, either by clicking the X or the backdrop
    const handleDialogCloseChange = (open: boolean) => {
        if (!open) {
            handleDialogClose() // Reset and close when dialog is closed
        }
        setIsOpen(open) // Update dialog open state
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogCloseChange}>
            <DialogTrigger asChild>
                {/* Physical Manifestation of the Dialog, the Button that opens it */}
                <Button
                    variant="outline"
                    className="!bg-blue-500 text-white border border-blue-600 shadow-sm hover:bg-blue-600"
                    onClick={() => setIsOpen(true)} // Open the dialog when the button is clicked
                >
                    Create New Role
                </Button>
            </DialogTrigger>
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
                    <PermissionTogglers permissions={permissions} onChange={setPermissions} />
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleDialogClose}>Cancel</Button>
                    <Button type="button" onClick={handleSaveChanges}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
