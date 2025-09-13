import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/shared/components/ui/dialog";
import { PersonInfoInput, PersonInfo } from "./PersonInfoInput";
import { PersonDetails } from "@/shared/types/Person";

type AddPersonDialogProps = {
    onCreate?: (person: PersonDetails) => void;
};

export const AddPersonDialog: React.FC<AddPersonDialogProps> = ({ onCreate }) => {
    const [info, setInfo] = React.useState<PersonInfo>({
        firstName: "",
        lastName: "",
        dob: { mm: "", dd: "", yyyy: "" },
        gender: "",
    });

    const isValid =
        info.firstName.trim().length > 0 &&
        info.lastName.trim().length > 0 &&
        info.dob.mm.length === 2 &&
        info.dob.dd.length === 2 &&
        info.dob.yyyy.length === 4 &&
        (info.gender === "M" || info.gender === "F");

    const toDetails = (p: PersonInfo): PersonDetails => ({
        id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        dob: { ...p.dob },
        gender: p.gender as "M" | "F",
    });

    const handleCreate = () => {
        if (!isValid) return;
        onCreate?.(toDetails(info));
        setInfo({
            firstName: "",
            lastName: "",
            dob: { mm: "", dd: "", yyyy: "" },
            gender: "",
        });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-blue-600 !text-white border border-blue-600 shadow-sm hover:!bg-blue-600"
                >
                    Add Family Member
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add Family Member</DialogTitle>
                    <DialogDescription>
                        Enter the person’s details below.
                    </DialogDescription>
                </DialogHeader>

                <PersonInfoInput value={info} onChange={setInfo} idPrefix="create" />

                <DialogFooter>
                    <DialogClose asChild>
                        <Button
                            variant="outline"
                            type="button"
                            className="!bg-transparent !text-foreground hover:!bg-muted"
                        >
                            Cancel
                        </Button>
                    </DialogClose>

                    <DialogClose asChild>
                        <Button type="button" onClick={handleCreate} disabled={!isValid}>
                            Create
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};