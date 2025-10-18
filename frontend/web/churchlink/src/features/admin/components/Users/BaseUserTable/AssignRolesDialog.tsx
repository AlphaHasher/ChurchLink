import { useState, useEffect } from "react";
import { BaseUserMask } from "@/shared/types/UserInfo";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { ChevronDown, ShieldPlus, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/shared/components/ui/dropdown-menu';
import PermBeforeAfterTable from "./PermBeforeAfterTable";
import { createPermComps, roleStringListToRoleIdList, getRoleOptions, processFetchedPermData } from "@/helpers/DataFunctions";
import { AccountPermissions } from "@/shared/types/AccountPermissions";

import { updateUserRoles } from "@/helpers/PermissionsHelper";
import { getMyPermissions } from "@/helpers/UserHelper";
import { MyPermsRequest } from "@/shared/types/MyPermsRequest";

interface AssignRolesDialogProps {
    userData: BaseUserMask;
    permData: AccountPermissions[];
    initialRoles: string[];
    onSave: () => Promise<void>;
}

interface RoleChangeParams {
    uid: string;
    role_ids: string[];
}

// Allows user to edit an already existing permission
export function AssignRolesDialog({
    userData,
    permData,
    initialRoles,
    onSave
}: AssignRolesDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoles);
    const [saving, setSaving] = useState(false);
    const [checkingPerms, setCheckingPerms] = useState(false)
    const [roleList, setRoleList] = useState<string[]>([]);

    const requestOptions: MyPermsRequest = {
        user_assignable_roles: true,
        event_editor_roles: false,
        user_role_ids: false,
    }

    // Update selected roles when initialRoles change
    useEffect(() => {
        setSelectedRoles(initialRoles);
    }, [initialRoles]);

    const handleDialogClose = () => {
        setIsOpen(false);
        setSelectedRoles(initialRoles);
    }

    const handleSaveChanges = async () => {
        setSaving(true);
        const reqParams: RoleChangeParams = {
            uid: userData.uid,
            role_ids: roleStringListToRoleIdList(permData, selectedRoles),
        };
        const res = await updateUserRoles(reqParams)
        if (res?.success) {
            await onSave()
            handleDialogClose()
        }
        else {
            alert(`Error!: ${res.msg}`)
        }
        setSaving(false);
    };

    const toggleRole = (role: string) => {
        setSelectedRoles((prevSelected) =>
            prevSelected.includes(role)
                ? prevSelected.filter((r) => r !== role)
                : [...prevSelected, role]
        );
    };

    // Handle when the dialog is closed, either by clicking the X or the backdrop
    const handleDialogCloseChange = (open: boolean) => {
        if (!open) {
            handleDialogClose() // Reset and close when dialog is closed
        }
        setIsOpen(open) // Update dialog open state
    }

    const handleCheckboxClick = (event: React.MouseEvent, role: string) => {
        event.preventDefault();  // Prevent dropdown from closing
        event.stopPropagation(); // Stop the event from propagating to the dropdown
        toggleRole(role); // Toggle the role selection
    };

    return (
        <>
            {/* Physical Manifestation of the Dialog, the Button that opens it */}
            <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                    setCheckingPerms(true)
                    try {
                        const result = await getMyPermissions(requestOptions)

                        if (result?.success) {

                            if (result?.perms.admin || result?.perms.permissions_management) {
                                try {
                                    const assignable = getRoleOptions(processFetchedPermData(result?.user_assignable_roles));
                                    setRoleList(assignable);
                                    setIsOpen(true);
                                }
                                catch {
                                    alert("Response format invalid: missing assignable permissions.");
                                }
                            }
                            else {
                                alert("You need to have the Administrator or Permissions Management perms to assign user roles!")
                            }
                        }
                        else {
                            alert(result?.msg || "You don't have permission to assign roles.")
                        }
                    } catch (err) {
                        alert("An error occurred while checking your permissions.")
                        console.error(err)
                    }
                    setCheckingPerms(false)
                }}
                disabled={checkingPerms}
            >
                {checkingPerms ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleDialogCloseChange}>
                <DialogContent className="max-w-3xl w-full max-h-screen flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Modify User Roles</DialogTitle>
                        <DialogDescription>
                            You are modifying the permission roles of <b>{userData.name}</b> (<i>{userData.email}</i>).
                            Ensure you have the correct user before making changes. You can only grant or revoke permissions
                            that your account already has.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Selection Section */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <label className="font-semibold">Assign Roles:</label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    {roleList.length === 0 ? (
                                        <Button variant="secondary" disabled>
                                            No Selectable Roles
                                        </Button>
                                    ) : (
                                        <Button 
                                            variant="outline" 
                                            className="flex items-center gap-2 dark:hover:bg-muted dark:hover:text-foreground focus-visible:ring-1 focus-visible:ring-border"
                                        >
                                            Select Roles <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    )}
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {roleList.map((role) => (
                                        <DropdownMenuCheckboxItem
                                            key={role}
                                            onClick={(event) => handleCheckboxClick(event, role)}
                                            checked={selectedRoles.includes(role)}
                                        >
                                            {role}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Permissions Table (Bounded & Scrollable) */}
                        <div className="border border-border rounded-lg shadow-sm p-4 bg-muted/30 max-h-[40vh] overflow-y-auto">
                            <PermBeforeAfterTable data={createPermComps(initialRoles, selectedRoles, permData)} />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <DialogFooter className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={handleDialogClose} disabled={saving}>Cancel</Button>
                        <Button variant="default" onClick={handleSaveChanges} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
