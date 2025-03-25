import { useState, useEffect } from "react";
import { BaseUserMask } from "@/types/UserInfo";
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
import { ChevronDown, ShieldPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import PermBeforeAfterTable from "./PermBeforeAfterTable";
import { createPermComps } from "@/helpers/DataFunctions";
import { AccountPermissions } from "@/types/AccountPermissions";

interface AssignRolesDialogProps {
    userData: BaseUserMask;
    permData: AccountPermissions[];
    roleList: string[]; // List of available roles
    initialRoles: string[]; // List of initial selected roles
}

// Allows user to edit an already existing permission
export function AssignRolesDialog({
    userData,
    permData,
    roleList,
    initialRoles
}: AssignRolesDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoles);

    // Update selected roles when initialRoles change
    useEffect(() => {
        setSelectedRoles(initialRoles);
    }, [initialRoles]);

    const handleDialogClose = () => setIsOpen(false);
    const handleSaveChanges = () => {
        handleDialogClose(); // Close the dialog after saving
        // Handle saving logic here (e.g., API call to update roles)
    };

    const toggleRole = (role: string) => {
        setSelectedRoles((prevSelected) =>
            prevSelected.includes(role)
                ? prevSelected.filter((r) => r !== role)
                : [...prevSelected, role]
        );
    };

    const handleCheckboxClick = (event: React.MouseEvent, role: string) => {
        event.preventDefault();  // Prevent dropdown from closing
        event.stopPropagation(); // Stop the event from propagating to the dropdown
        toggleRole(role); // Toggle the role selection
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-white text-black border shadow-sm hover:bg-blue-600"
                >
                    <ShieldPlus />
                </Button>
            </DialogTrigger>
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
                                <Button variant="outline" className="!bg-white flex items-center gap-2">
                                    Select Roles <ChevronDown />
                                </Button>
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
                    <div className="border rounded-lg shadow-sm p-4 bg-gray-50 max-h-[40vh] overflow-y-auto">
                        <PermBeforeAfterTable data={createPermComps(initialRoles, selectedRoles, permData)} />
                    </div>
                </div>

                {/* Footer Buttons */}
                <DialogFooter className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" className="text-white" onClick={handleDialogClose}>Cancel</Button>
                    <Button variant="default" onClick={handleSaveChanges}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
