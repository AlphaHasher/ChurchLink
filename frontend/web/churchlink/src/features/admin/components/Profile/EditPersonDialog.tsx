import * as React from "react";
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
import { Button } from "@/shared/components/ui/button";
import { Pencil } from "lucide-react";
import { PersonInfoInput, PersonInfo } from "./PersonInfoInput";
import { PersonDetails } from "@/shared/types/Person";

type EditPersonDialogProps = {
    person: PersonDetails;
    className?: string;
    /** Called with the updated person when the user saves */
    onUpdate?: (next: PersonDetails) => void;
};

export const EditPersonDialog: React.FC<EditPersonDialogProps> = ({
    person,
    className,
    onUpdate,
}) => {
    // Convert incoming details -> form state
    const toInfo = (p: PersonDetails): PersonInfo => ({
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        dob: { mm: p.dob.mm ?? "", dd: p.dob.dd ?? "", yyyy: p.dob.yyyy ?? "" },
        gender: (p.gender ?? "") as PersonInfo["gender"],
    });

    // Convert form state -> outgoing details
    const toDetails = (base: PersonDetails, info: PersonInfo): PersonDetails => ({
        ...base,
        firstName: info.firstName.trim(),
        lastName: info.lastName.trim(),
        dob: { ...info.dob },
        gender: info.gender as "M" | "F",
    });

    const [info, setInfo] = React.useState<PersonInfo>(toInfo(person));

    // If a different person is edited, refresh defaults
    React.useEffect(() => {
        setInfo(toInfo(person));
    }, [person.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const isValid =
        info.firstName.trim().length > 0 &&
        info.lastName.trim().length > 0 &&
        info.dob.mm.length === 2 &&
        info.dob.dd.length === 2 &&
        info.dob.yyyy.length === 4 &&
        (info.gender === "M" || info.gender === "F");

    const handleSave = () => {
        if (!isValid) return;
        onUpdate?.(toDetails(person, info));
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className={[
                        "h-8 w-8 !bg-white border shadow-sm hover:bg-blue-600/10",
                        className,
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    title="Edit person"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Family Member</DialogTitle>
                    <DialogDescription>
                        Update the person’s details below.
                    </DialogDescription>
                </DialogHeader>

                {/* Prefilled, reusable form block */}
                <PersonInfoInput value={info} onChange={setInfo} idPrefix={`edit-${person.id}`} />

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
                        <Button type="button" onClick={handleSave} disabled={!isValid}>
                            Save changes
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
