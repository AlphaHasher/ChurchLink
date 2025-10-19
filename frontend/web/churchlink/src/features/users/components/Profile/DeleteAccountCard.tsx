import React, { useState } from "react";
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
import { Input } from "@/shared/components/ui/input";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import api from "@/api/api";
import { useNavigate } from "react-router-dom";
import { auth, signOut } from "@/lib/firebase";
import { useAuth } from "@/features/auth/hooks/auth-context";

export const DeleteAccountCard: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [emailInput, setEmailInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { user } = useAuth();
    const userEmail = user?.email || "";

    const isEmailMatching = emailInput.trim() === userEmail;

    const handleDelete = async () => {
        if (!isEmailMatching) return;

        setLoading(true);
        setError(null);

        try {
            // Call backend to delete account from both MongoDB and Firebase
            await api.delete("/v1/users/delete-account");

            // Log out the user
            await signOut(auth);

            // Redirect to home
            navigate("/");
        } catch (err: any) {
            // Check if the error is specifically about admin accounts
            const errorDetail = err?.response?.data?.detail || "";
            const errorMessage = err?.response?.data?.message || "";
            
            if (errorDetail.includes("Administrator") || errorMessage.includes("Administrator")) {
                setError(
                    "Administrator accounts cannot be deleted. To delete your account, you must first have another administrator remove your administrator privileges."
                );
            } else {
                const message =
                    errorDetail ||
                    errorMessage ||
                    err?.message ||
                    "Failed to delete account";
                setError(message);
            }
            setLoading(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setEmailInput("");
            setError(null);
        }
    };

    return (
        <>
            <motion.div
                className="w-full rounded-xl border bg-white p-4 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900">Danger Zone</h3>
                        <p className="mt-1 text-sm text-gray-600">
                            Permanently delete your account and all associated data
                        </p>
                    </div>
                    <Button
                        onClick={() => handleOpenChange(true)}
                        variant="destructive"
                        size="sm"
                        className="ml-4 flex items-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Account
                    </Button>
                </div>
            </motion.div>

            <AlertDialog open={open} onOpenChange={handleOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-4 mt-4">
                                <p>
                                    This action cannot be undone. This will permanently delete your account and all associated data
                                    from our servers.
                                </p>
                                <p className="font-semibold text-gray-900">
                                    To confirm, please type your email address:
                                </p>
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-600">Your email: {userEmail}</p>
                                    <Input
                                        placeholder="Enter your email address"
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                        className="font-mono"
                                        autoFocus
                                    />
                                </div>
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
                            disabled={!isEmailMatching || loading}
                            className="bg-destructive text-destructive-foreground hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Deleting..." : "Confirm Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
