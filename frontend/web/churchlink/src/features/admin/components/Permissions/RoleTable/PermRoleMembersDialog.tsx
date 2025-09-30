import { useState } from "react";
import { AccountPermissions } from "@/shared/types/AccountPermissions";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import RoleMembersTable from "./RoleMembersTable";
import { applyRoleMemberMask } from "@/helpers/DataFunctions";
import { UserInfo } from "@/shared/types/UserInfo";
import { Users } from "lucide-react";
interface PermRoleMembersDialogProps {
    permissions: AccountPermissions;
    userData: UserInfo[];
    permData: AccountPermissions[];
}

//Dialog that allows the user to delete an existing permission
export function PermRoleMembersDialog({
    permissions: initialPermissions, userData: userData, permData: permData,
}: PermRoleMembersDialogProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-background text-destructive border shadow-sm !hover:bg-destructive"
                    onClick={() => setIsOpen(true)} // Open the dialog when the button is clicked
                >
                    <Users />
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
