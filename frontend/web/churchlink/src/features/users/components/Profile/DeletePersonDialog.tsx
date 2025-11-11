import * as React from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
    DialogTrigger, DialogFooter
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Trash, Loader2 } from "lucide-react";
import { PersonLite } from "@/shared/types/Person";
import { deleteFamilyMember } from "@/helpers/UserHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

type DeletePersonDialogProps = {
    person: PersonLite;
    className?: string;
    onDeleted?: (personId: string) => void;
    onDelete?: (personId: string) => Promise<void> | void;
};

export const DeletePersonDialog: React.FC<DeletePersonDialogProps> = ({
    person,
    className,
    onDeleted,
    onDelete,
}) => {
    const localize = useLocalize();
    const [isOpen, setIsOpen] = React.useState(false);
    const [userInput, setUserInput] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);

    const fullName = `${person.first_name} ${person.last_name}`.trim();
    const isDeleteEnabled = userInput.trim() === fullName;

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

            if (onDelete) {
                await onDelete(person.id);
                onDeleted?.(person.id);
                handleClose();
                return;
            }

            const res = await deleteFamilyMember(person.id);
            if (res?.success) {
                onDeleted?.(person.id);
                handleClose();
            } else {
                throw new Error(localize("Delete failed"));
            }
        } catch (err) {
            console.error(err);
            alert(localize("Could not delete this person. Please try again."));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className={["h-8 w-8 !bg-white border shadow-sm hover:bg-red-600/10", className].filter(Boolean).join(" ")}
                    title={localize("Delete person")}
                >
                    <Trash className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md z-500">
                <DialogHeader>
                    <DialogTitle>{localize("Delete Family Member")}</DialogTitle>
                    <DialogDescription>
                        {localize("This action cannot be undone. To confirm, type the full name:")}
                        <br />
                        <span className="font-medium text-foreground">{fullName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="confirm-delete">{localize("Deletion confirmation")}</Label>
                        <small className="text-gray-500 text-xs">
                            {localize("Type")} <span className="font-medium">{fullName}</span> {localize("to confirm.")}
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
                        {localize("Cancel")}
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
                                {localize("Deleting…")}
                            </>
                        ) : (
                            localize("Confirm Delete")
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
