import { useState, useEffect } from "react";
import { AccountPermissions } from "@/types/AccountPermissions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconTrash } from "@tabler/icons-react";

interface DeletePermDialogProps {
    permissions: AccountPermissions;
}

//Dialog that allows the user to delete an existing permission
export function DeletePermDialog({
    permissions: initialPermissions,
}: DeletePermDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [userInput, setUserInput] = useState(""); // Track user input
    const [isDeleteEnabled, setIsDeleteEnabled] = useState(false); // Enable delete only when the input matches the name

    useEffect(() => {
        // Reset user input and delete enabled status when dialog is opened
        setUserInput("");
        setIsDeleteEnabled(false);
    }, [isOpen]);

    const handleDialogClose = () => {
        setIsOpen(false);
        setUserInput(""); // Reset the input when the dialog closes
    };

    //TEST OUTPUT: Just spits out an alert to show it works
    const handleDelete = () => {
        if (userInput === initialPermissions.name) {
            alert(`Deleted permission set: ${initialPermissions.name}`);
            handleDialogClose();
        } else {
            alert("Names do not match. Please try again.");
        }
    };

    // Enable the delete button when the user input matches the permissions name
    useEffect(() => {
        setIsDeleteEnabled(userInput === initialPermissions.name);
    }, [userInput, initialPermissions.name]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-white text-red border shadow-sm !hover:bg-red-600"
                    onClick={() => setIsOpen(true)} // Open the dialog when the button is clicked
                >
                    <IconTrash stroke={2} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Delete Permission Role</DialogTitle>
                    <div className="pt-6">
                        <DialogDescription>
                            Are you absolutely sure you want to delete the permission role "
                            {initialPermissions.name}"? This action cannot be undone. Please
                            type the name "{initialPermissions.name}" to confirm the deletion.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Deletion Confirmation</Label>
                        <small className="text-gray-500 text-xs">
                            Type the name "{initialPermissions.name}" to confirm that you
                            want to delete this permission role.
                        </small>
                        <Input
                            id="name"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleDialogClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="!bg-red-30"
                        onClick={handleDelete}
                        disabled={!isDeleteEnabled} // Disable delete button until input matches the name
                    >
                        Confirm Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
