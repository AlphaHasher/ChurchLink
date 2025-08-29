import { useState } from "react";
import { AccountPermissions } from "@/types/AccountPermissions";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/shadcn/Dialog";
import { IconUsersGroup } from "@tabler/icons-react";
import RoleMembersTable from "./RoleMembersTable";
import { applyRoleMemberMask } from "@/helpers/DataFunctions";
import { UserInfo } from "@/types/UserInfo";

interface PermRoleMembersDialogProps {
    permissions: AccountPermissions;
    userData: UserInfo[];
    permData: AccountPermissions[];
}

//Dialog that allows the user to delete an existing permission
export function PermRoleMembersDialog({
    permissions: initialPermissions, userData: userData, permData: permData
}: PermRoleMembersDialogProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-white text-red border shadow-sm !hover:bg-red-600"
                    onClick={() => setIsOpen(true)} // Open the dialog when the button is clicked
                >
                    <IconUsersGroup stroke={2} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Users with Permissions Role "{initialPermissions.name}"</DialogTitle>
                    <DialogDescription>
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <small className="text-gray-500 text-m">
                            A table quickly allowing you to examine who has the "{initialPermissions.name}" Permission Role. You can assign and unassign Permission Roles in the "Manage Users" section of the dashboard.
                        </small>
                        <RoleMembersTable data={applyRoleMemberMask(userData, permData, initialPermissions.name)} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
