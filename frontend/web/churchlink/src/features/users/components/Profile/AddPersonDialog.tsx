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
} from "@/shared/components/ui/Dialog";
import { PersonInfoInput, PersonInfo } from "./PersonInfoInput";
import { PersonDetails } from "@/shared/types/Person";
import { addFamilyMember } from "@/helpers/UserHelper";

type AddPersonDialogProps = {
    onAdded?: (person: PersonDetails) => void;
};

export const AddPersonDialog: React.FC<AddPersonDialogProps> = ({ onAdded }) => {
    const [info, setInfo] = React.useState<PersonInfo>({
        firstName: "",
        lastName: "",
        dob: { mm: "", dd: "", yyyy: "" },
        gender: "",
    });
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const isValid =
        info.firstName.trim().length > 0 &&
        info.lastName.trim().length > 0 &&
        info.dob.mm.length === 2 &&
        info.dob.dd.length === 2 &&
        info.dob.yyyy.length === 4 &&
        (info.gender === "M" || info.gender === "F");

    const toDetails = (p: PersonInfo): PersonDetails => {
        const yyyy = parseInt(p.dob.yyyy, 10);
        const mm = parseInt(p.dob.mm, 10) - 1; // 0–11
        const dd = parseInt(p.dob.dd, 10);
        const date = new Date(yyyy, mm, dd);

        return {
            id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
            first_name: p.firstName.trim(),
            last_name: p.lastName.trim(),
            date_of_birth: date,
            gender: p.gender as "M" | "F",
        };
    };

    const resetForm = () =>
        setInfo({
            firstName: "",
            lastName: "",
            dob: { mm: "", dd: "", yyyy: "" },
            gender: "",
        });

    const handleCreate = async () => {
        if (!isValid || submitting) return;

        setSubmitting(true);
        setError(null);

        const details = toDetails(info);

        const res = await addFamilyMember(details);
        setSubmitting(false);

        if (res?.success) {
            onAdded?.(details);
            resetForm();
        } else {
            setError("Failed to add family member. Please try again.");
        }
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
                    <DialogDescription>Enter the person’s details below.</DialogDescription>
                </DialogHeader>

                <PersonInfoInput value={info} onChange={setInfo} idPrefix="create" />

                {error && (
                    <div className="mt-2 text-sm text-red-600" role="alert">
                        {error}
                    </div>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button
                            variant="outline"
                            type="button"
                            className="!bg-transparent !text-foreground hover:!bg-muted"
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                    </DialogClose>

                    <DialogClose asChild>
                        <Button type="button" onClick={handleCreate} disabled={!isValid || submitting}>
                            {submitting ? "Creating..." : "Create"}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
