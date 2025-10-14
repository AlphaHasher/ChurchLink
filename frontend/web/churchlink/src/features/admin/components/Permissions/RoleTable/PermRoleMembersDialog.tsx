import { useEffect, useState } from "react";
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
import { PermRoleMemberMask } from "@/shared/types/UserInfo";
import { Users } from "lucide-react";
import { fetchUsersWithRole } from "@/helpers/UserHelper";

interface PermRoleMembersDialogProps {
    permissions: AccountPermissions;
}

export function PermRoleMembersDialog({ permissions }: PermRoleMembersDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<PermRoleMemberMask[]>([]);

    // When dialog opens, fetch users for this role id
    useEffect(() => {
        const run = async () => {
            if (!isOpen) return;
            setLoading(true);
            try {
                const users = await fetchUsersWithRole(permissions._id);
                const masked: PermRoleMemberMask[] = users.map(u => ({
                    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.uid,
                    email: u.email,
                }));
                setMembers(masked);
            } catch (e) {
                console.error("Failed fetching users for role", e);
                setMembers([]);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [isOpen, permissions._id]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-white text-red border shadow-sm !hover:bg-red-600"
                    onClick={() => setIsOpen(true)}
                    title="View members"
                >
                    <Users />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        Users with Permission Role &quot;{permissions.name}&quot;
                    </DialogTitle>
                    <DialogDescription />
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <small className="text-gray-500 text-m">
                            Quickly examine which users have the &quot;{permissions.name}&quot; role. Assign/unassign roles in the Manage Users section.
                        </small>
                        <RoleMembersTable data={members} loading={loading} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
