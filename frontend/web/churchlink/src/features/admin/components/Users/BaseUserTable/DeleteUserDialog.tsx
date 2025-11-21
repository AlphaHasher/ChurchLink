import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import api from "@/api/api";

interface DeleteUserDialogProps {
    userId: string;
    userEmail: string;
    userName: string;
    isAdmin?: boolean;
    onDeleted: () => Promise<void>;
}

export const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({
    userId,
    userEmail,
    userName,
    isAdmin = false,
    onDeleted,
}) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = async () => {
        setLoading(true);
        setError(null);

        try {
            // Call admin endpoint to delete user
            await api.delete(`/v1/users/delete-user/${userId}`);

            // Refresh the users list
            await onDeleted();

            // Close the dialog
            setOpen(false);
        } catch (err: any) {
            const message =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to delete user";
            setError(message);
            setLoading(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setError(null);
        }
    };

    return (
        <>
            <Button
                onClick={() => handleOpenChange(true)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={isAdmin}
                title={isAdmin ? "Administrator accounts cannot be deleted" : "Delete user account"}
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            <AlertDialog open={open} onOpenChange={handleOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-3 mt-4">
                                <p>
                                    Are you sure you want to delete this user account? This action cannot be undone.
                                </p>
                                <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
                                    <p className="text-sm font-semibold text-amber-900">User Information:</p>
                                    <p className="text-sm text-amber-800">Name: {userName}</p>
                                    <p className="text-sm text-amber-800">Email: {userEmail}</p>
                                </div>
                                <p className="text-sm text-gray-600">
                                    The user will be permanently deleted from both MongoDB and Firebase Authentication. This user will automatically be refunded for and unregistered from any upcoming events.
                                </p>
                                {error && (
                                    <p className="rounded bg-red-50 p-2 text-sm text-red-700">
                                        {error}
                                    </p>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => handleOpenChange(false)} disabled={loading}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={loading}
                            className="bg-destructive text-destructive-foreground hover:bg-red-700"
                        >
                            {loading ? "Deleting..." : "Delete User"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
