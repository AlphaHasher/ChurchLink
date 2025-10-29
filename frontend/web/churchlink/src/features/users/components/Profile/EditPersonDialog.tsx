import * as React from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
    DialogTrigger, DialogFooter, DialogClose
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Pencil } from "lucide-react";
import { PersonInfoInput, PersonInfo } from "./PersonInfoInput";
import { PersonDetails } from "@/shared/types/Person";
import { editFamilyMember } from "@/helpers/UserHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

type EditPersonDialogProps = {
    person: PersonDetails;
    className?: string;
    onUpdated?: (next: PersonDetails) => void;
};

export const EditPersonDialog: React.FC<EditPersonDialogProps> = ({
    person,
    className,
    onUpdated,
}) => {
    const localize = useLocalize();
    const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
    const toInfo = (p: PersonDetails): PersonInfo => {
        const d = new Date(p.date_of_birth);
        return {
            firstName: p.first_name ?? "",
            lastName: p.last_name ?? "",
            dob: { mm: pad2(d.getMonth() + 1), dd: pad2(d.getDate()), yyyy: String(d.getFullYear()) },
            gender: (p.gender ?? "") as PersonInfo["gender"],
        };
    };

    const toDetails = (base: PersonDetails, info: PersonInfo): PersonDetails => {
        const yyyy = parseInt(info.dob.yyyy, 10);
        const mm = parseInt(info.dob.mm, 10) - 1;
        const dd = parseInt(info.dob.dd, 10);
        const date = new Date(yyyy, mm, dd);
        return {
            ...base,
            first_name: info.firstName.trim(),
            last_name: info.lastName.trim(),
            date_of_birth: date,
            gender: info.gender as "M" | "F",
        };
    };

    const [info, setInfo] = React.useState<PersonInfo>(toInfo(person));
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        setInfo(toInfo(person));
    }, [person.id]);

    const isValid =
        info.firstName.trim().length > 0 &&
        info.lastName.trim().length > 0 &&
        info.dob.mm.length === 2 &&
        info.dob.dd.length === 2 &&
        info.dob.yyyy.length === 4 &&
        (info.gender === "M" || info.gender === "F");

    const handleSave = async () => {
        if (!isValid || submitting) return;
        setSubmitting(true);
        setError(null);
        const updated = toDetails(person, info);
        const res = await editFamilyMember(updated);
        setSubmitting(false);

        if (res?.success) {
            onUpdated?.(updated);
        } else {
            setError(localize("Failed to save changes. Please try again."));
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className={["h-8 w-8 !bg-white border shadow-sm hover:bg-blue-600/10", className].filter(Boolean).join(" ")}
                    title={localize("Edit person")}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{localize("Edit Family Member")}</DialogTitle>
                    <DialogDescription>{localize("Update the person’s details below.")}</DialogDescription>
                </DialogHeader>

                <PersonInfoInput value={info} onChange={setInfo} idPrefix={`edit-${person.id}`} />

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

                    <DialogClose asChild>
                        <Button type="button" onClick={handleSave} disabled={!isValid || submitting}>
                            {submitting ? localize("Saving...") : localize("Save changes")}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
