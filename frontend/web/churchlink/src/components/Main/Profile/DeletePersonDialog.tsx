import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash, Loader2 } from "lucide-react";

type PersonLite = { id: string; firstName: string; lastName: string };

type DeletePersonDialogProps = {
    person: PersonLite;
    className?: string;
    /** Called when the user confirms delete (do your API call here). Close on resolve. */
    onDelete?: (personId: string) => Promise<void> | void;
};

export const DeletePersonDialog: React.FC<DeletePersonDialogProps> = ({
    person,
    className,
    onDelete,
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [userInput, setUserInput] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);

    const fullName = `${person.firstName} ${person.lastName}`.trim();
    const isDeleteEnabled = userInput.trim() === fullName;

    // reset on open/close
    React.useEffect(() => {
        if (isOpen) {
            setUserInput("");
            setIsDeleting(false);
        }
    }, [isOpen]);

    const handleClose = () => setIsOpen(false);

    const handleDelete = async () => {
        if (!isDeleteEnabled || isDeleting) return;
        try {
            setIsDeleting(true);
            await onDelete?.(person.id);
            handleClose();
        } catch (err) {
            console.error(err);
            alert("Could not delete this person. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            {/* Trigger button (keeps your small square icon style) */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className={[
                            "h-8 w-8 !bg-white border shadow-sm hover:bg-red-600/10",
                            className,
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        title="Delete person"
                    >
                        <Trash className="h-4 w-4" />
                    </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Family Member</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. To confirm, type the full name:
                            <br />
                            <span className="font-medium text-foreground">{fullName}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="confirm-delete">Deletion confirmation</Label>
                            <small className="text-gray-500 text-xs">
                                Type <span className="font-medium">{fullName}</span> to confirm.
                            </small>
                            <Input
                                id="confirm-delete"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder={fullName}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="!bg-transparent !text-foreground hover:!bg-muted"
                            onClick={handleClose}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            className="!bg-red-600 !text-white hover:!bg-red-700"
                            onClick={handleDelete}
                            disabled={!isDeleteEnabled || isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                    Deleting…
                                </>
                            ) : (
                                "Confirm Delete"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};