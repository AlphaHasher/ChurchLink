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
import { addFamilyMember } from "@/helpers/UserHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

type AddPersonDialogProps = {
    onCreated?: () => void;
};

export const AddPersonDialog: React.FC<AddPersonDialogProps> = ({ onCreated }) => {
    const localize = useLocalize();
    const [info, setInfo] = React.useState<PersonInfo>({
        firstName: "",
        lastName: "",
        dob: { mm: "", dd: "", yyyy: "" },
        gender: "",
    });
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);

    const isValid =
        info.firstName.trim().length > 0 &&
        info.lastName.trim().length > 0 &&
        info.dob.mm.length === 2 &&
        info.dob.dd.length === 2 &&
        info.dob.yyyy.length === 4 &&
        (info.gender === "M" || info.gender === "F");

    const toApiPayload = (p: PersonInfo) => {
        const yyyy = parseInt(p.dob.yyyy, 10);
        const mm = parseInt(p.dob.mm, 10) - 1;
        const dd = parseInt(p.dob.dd, 10);
        const date = new Date(yyyy, mm, dd);

        return {
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

        const payload = toApiPayload(info);

        try {
            const res = await addFamilyMember(payload as any);
            if (res?.success) {
                onCreated?.();
                resetForm();
				setOpen(false);
            } else {
                setError(localize("Failed to add family member. Please try again."));
            }
        } catch (e) {
            setError(localize("Failed to add family member. Please try again."));
        } finally {
            setSubmitting(false);
        }
    };

	return (
		<Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-blue-600 !text-white border border-blue-600 shadow-sm hover:!bg-blue-600"
                >
                    {localize("Add Family Member")}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{localize("Add Family Member")}</DialogTitle>
                    <DialogDescription>{localize("Enter the person’s details below.")}</DialogDescription>
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
							{localize("Cancel")}
						</Button>
					</DialogClose>

					<Button type="button" onClick={handleCreate} disabled={!isValid || submitting}>
						{submitting ? localize("Creating...") : localize("Create")}
					</Button>
				</DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
